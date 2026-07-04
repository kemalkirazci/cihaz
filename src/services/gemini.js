/**
 * Rejista - Gemini AI Servisi
 * Görüntü analizi, strateji oluşturma ve prompt üretimi
 *
 * GÜVENLİK İYİLEŞTİRMELERİ:
 * - Güvenli JSON parsing
 * - API key validation
 * - Improved error handling
 * - Response validation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { costTracker } from '../utils/costTracker.js';
import { withRetry, withTimeout } from '../utils/retry.js';
import { extractJsonFromText, validateObject } from '../utils/helpers.js';

// Default değerler (parse hatası durumunda)
const DEFAULT_ANALYSIS = {
  product: { name: 'Unknown', category: 'unknown', material: 'unknown', style: 'unknown' },
  visual: { dominantColors: ['#808080'], colorPalette: 'neutral', lighting: 'mixed', backgroundType: 'unknown' },
  mood: { primary: 'neutral', secondary: 'unknown', targetAudience: 'general' },
  objects: [],
  videoSuggestions: { focusPoints: [], avoidElements: [], recommendedDuration: 60, aspectRatioRecommendation: '16:9' },
  qualityScore: { overall: 5, sharpness: 5, composition: 5, commercialPotential: 5 }
};

const DEFAULT_QC_RESULT = {
  passed: false,
  overallScore: 0,
  checks: {},
  issues: ['QC parsing failed'],
  recommendation: 'revise'
};

const DEFAULT_DECISION = {
  decision: 'pause', // Güvenli tarafta kal - proceed yerine pause
  reasoning: 'Parse hatası nedeniyle güvenli karar',
  nextAction: 'manual_review',
  priority: 'high',
  warnings: ['Automated decision failed - manual review required']
};

class GeminiService {
  constructor() {
    this.genAI = null;
    this.proModel = null;
    this.flashModel = null;
    this.initialized = false;
  }

  /**
   * Servisi başlat
   */
  async initialize() {
    // API key kontrolü
    if (!config.gemini.apiKey) {
      const error = new Error('GEMINI_API_KEY is not configured');
      logger.error('Gemini initialization failed: API key missing');
      throw error;
    }

    if (config.gemini.apiKey.length < 20) {
      const error = new Error('GEMINI_API_KEY appears to be invalid (too short)');
      logger.error('Gemini initialization failed: API key too short');
      throw error;
    }

    try {
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);

      // Pro model - kompleks görevler için
      this.proModel = this.genAI.getGenerativeModel({
        model: config.gemini.model,
        generationConfig: {
          maxOutputTokens: config.gemini.maxTokens,
          temperature: config.gemini.temperature
        }
      });

      // Flash model - hızlı ve ucuz görevler için
      this.flashModel = this.genAI.getGenerativeModel({
        model: config.gemini.flashModel,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.5
        }
      });

      // Test connection with a simple request
      await this._testConnection();

      this.initialized = true;
      logger.info('Gemini servisi başlatıldı', {
        proModel: config.gemini.model,
        flashModel: config.gemini.flashModel
      });

      return true;
    } catch (error) {
      logger.error('Gemini servisi başlatılamadı', { error: error.message });
      throw error;
    }
  }

  /**
   * Bağlantıyı test et
   */
  async _testConnection() {
    try {
      const result = await withTimeout(
        this.flashModel.generateContent('Say "OK" if you can read this.'),
        config.gemini.connectionTestTimeoutMs,
        'connectionTest'
      );
      const text = result.response.text();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }
      logger.debug('Gemini connection test passed');
    } catch (error) {
      logger.error('Gemini connection test failed', { error: error.message });
      throw new Error(`Gemini connection failed: ${error.message}`);
    }
  }

  /**
   * Servis hazır mı kontrol et
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Gemini service not initialized. Call initialize() first.');
    }
  }

  /**
   * Token kullanımını kaydet
   */
  _trackUsage(orderId, usage, modelType = 'pro') {
    if (!usage) return;

    const inputType = modelType === 'pro' ? 'gemini_pro_input' : 'gemini_flash_input';
    const outputType = modelType === 'pro' ? 'gemini_pro_output' : 'gemini_flash_output';

    costTracker.addCost(orderId, inputType, usage.promptTokenCount || 0);
    costTracker.addCost(orderId, outputType, usage.candidatesTokenCount || 0);
  }

  /**
   * Ürün görsellerini analiz et
   */
  async analyzeProductImages(orderId, images) {
    this._ensureInitialized();

    return withRetry(
      async () => {
        if (!images || images.length === 0) {
          throw new Error('Analiz için görsel bulunamadı');
        }

        const prompt = `
Sen bir e-ticaret ürün analisti ve video pazarlama uzmanısın. Aşağıdaki ürün görsellerini analiz et ve profesyonel bir ticari video üretimi için gerekli tüm bilgileri çıkar.

Analiz sonucunu SADECE aşağıdaki JSON formatında döndür, başka açıklama ekleme:

{
  "product": {
    "name": "Ürün adı tahmini",
    "category": "Ürün kategorisi (jewelry, clothing, home decor, art, accessories, etc.)",
    "material": "Görünen malzeme (gold, silver, wood, ceramic, fabric, etc.)",
    "style": "Stil (modern, vintage, bohemian, minimalist, rustic, etc.)"
  },
  "visual": {
    "dominantColors": ["#hex1", "#hex2", "#hex3"],
    "colorPalette": "warm/cool/neutral/vibrant",
    "lighting": "Mevcut aydınlatma kalitesi (studio, natural, mixed)",
    "backgroundType": "white/colored/textured/lifestyle"
  },
  "mood": {
    "primary": "Ana duygu (luxury, playful, cozy, elegant, edgy, natural)",
    "secondary": "İkincil duygu",
    "targetAudience": "Hedef kitle tahmini"
  },
  "objects": [
    {
      "name": "Tespit edilen obje",
      "prominence": "high/medium/low",
      "suggestedAngle": "Önerilen çekim açısı"
    }
  ],
  "videoSuggestions": {
    "focusPoints": ["Vurgulanması gereken özellikler"],
    "avoidElements": ["Kaçınılması gereken unsurlar"],
    "recommendedDuration": 60,
    "aspectRatioRecommendation": "16:9"
  },
  "qualityScore": {
    "overall": 7,
    "sharpness": 7,
    "composition": 7,
    "commercialPotential": 7
  }
}`;

        // Görselleri model formatına çevir
        const imageParts = images.slice(0, 10).map((img) => ({ // Max 10 görsel
          inlineData: {
            data: img.content,
            mimeType: img.mimeType || 'image/jpeg'
          }
        }));

        const result = await withTimeout(
          this.proModel.generateContent([prompt, ...imageParts]),
          config.gemini.analysisTimeoutMs,
          'imageAnalysis'
        );

        const response = result.response;
        const text = response.text();

        this._trackUsage(orderId, response.usageMetadata, 'pro');

        // Güvenli JSON parse
        const analysis = extractJsonFromText(text, null, 'analyzeProductImages');

        if (!analysis) {
          logger.error('Failed to parse image analysis response', {
            orderId,
            responsePreview: text.slice(0, 200)
          });
          throw new Error('Invalid analysis response from Gemini');
        }

        // Temel validation
        if (!validateObject(analysis, ['product', 'visual', 'mood'])) {
          logger.warn('Analysis response missing required fields, using defaults', { orderId });
          return { ...DEFAULT_ANALYSIS, ...analysis };
        }

        logger.info('Görsel analizi tamamlandı', {
          orderId,
          imageCount: images.length,
          category: analysis.product?.category
        });

        return analysis;
      },
      { operationName: 'analyzeProductImages', maxAttempts: 2 }
    );
  }

  /**
   * Video konseptleri oluştur
   */
  async generateVideoConcepts(orderId, analysis) {
    this._ensureInitialized();

    return withRetry(
      async () => {
        const prompt = `
Sen bir yaratıcı direktör ve video pazarlama uzmanısın. Aşağıdaki ürün analizine dayanarak 3 farklı video konsepti oluştur.

ÜRÜN ANALİZİ:
${JSON.stringify(analysis, null, 2)}

Her konsept için aşağıdaki JSON formatını kullan. SADECE JSON döndür:

{
  "concepts": [
    {
      "type": "ENERGETIC",
      "name": "Enerjik",
      "description": "Konseptin kısa açıklaması",
      "visualStyle": {
        "colorGrading": "Renk tonu açıklaması",
        "transitions": "Geçiş tipi",
        "pace": "fast",
        "cameraMovement": "Kamera hareketi türü"
      },
      "musicMood": "Müzik türü/mood",
      "keyScenes": [
        {
          "order": 1,
          "duration": 15,
          "description": "Sahne açıklaması",
          "focusElement": "Odak noktası",
          "cameraAngle": "Kamera açısı"
        }
      ],
      "targetEmotion": "Hedeflenen duygu",
      "callToAction": "CTA metni önerisi"
    },
    {
      "type": "MINIMAL",
      "name": "Minimal"
    },
    {
      "type": "CINEMATIC",
      "name": "Sinematik"
    }
  ]
}

Her konsept için en az 4 sahne tanımla. Toplam video süresi ${config.video.durationSeconds} saniye olmalı.`;

        const result = await withTimeout(
          this.proModel.generateContent(prompt),
          config.gemini.timeout || 45000,
          'generateConcepts'
        );

        const response = result.response;
        const text = response.text();

        this._trackUsage(orderId, response.usageMetadata, 'pro');

        const conceptsData = extractJsonFromText(text, null, 'generateVideoConcepts');

        if (!conceptsData || !Array.isArray(conceptsData.concepts)) {
          logger.error('Failed to parse concepts response', { orderId });
          throw new Error('Invalid concepts response from Gemini');
        }

        // En az 1 konsept olmalı
        if (conceptsData.concepts.length === 0) {
          throw new Error('No concepts generated');
        }

        logger.info('Video konseptleri oluşturuldu', {
          orderId,
          conceptCount: conceptsData.concepts.length
        });

        return conceptsData.concepts;
      },
      { operationName: 'generateVideoConcepts', maxAttempts: 2 }
    );
  }

  /**
   * Video üretim promptu oluştur (Veo 2 için)
   */
  async generateVideoPrompt(orderId, concept, analysis) {
    this._ensureInitialized();

    return withRetry(
      async () => {
        const prompt = `
Sen bir AI video üretim sistemleri için profesyonel prompt mühendisisin. Google Veo 2 video üretim modeli için optimize edilmiş bir prompt yaz.

ÜRÜN BİLGİLERİ:
${JSON.stringify(analysis.product || {}, null, 2)}

GÖRSEL ÖZELLİKLER:
${JSON.stringify(analysis.visual || {}, null, 2)}

KONSEPT:
${JSON.stringify(concept, null, 2)}

Aşağıdaki JSON formatında döndür:

{
  "mainPrompt": "Ana video üretim promptu - detaylı, görsel açıklama içeren, hareket ve geçişleri tanımlayan profesyonel prompt",
  "negativePrompt": "Kaçınılması gereken unsurlar",
  "styleModifiers": ["stil modifikatörleri listesi"],
  "technicalParams": {
    "duration": ${config.video.durationSeconds},
    "fps": 30,
    "resolution": "${config.video.resolution}",
    "aspectRatio": "16:9"
  },
  "sceneBreakdown": [
    {
      "timeCode": "0:00-0:15",
      "prompt": "Bu zaman aralığı için spesifik prompt",
      "transition": "Geçiş tipi"
    }
  ]
}`;

        const result = await withTimeout(
          this.flashModel.generateContent(prompt),
          config.gemini.conceptTimeoutMs,
          'generateVideoPrompt'
        );

        const response = result.response;
        const text = response.text();

        this._trackUsage(orderId, response.usageMetadata, 'flash');

        const promptData = extractJsonFromText(text, null, 'generateVideoPrompt');

        if (!promptData || !promptData.mainPrompt) {
          logger.error('Failed to parse video prompt response', { orderId });
          throw new Error('Invalid video prompt response from Gemini');
        }

        logger.info('Video promptu oluşturuldu', {
          orderId,
          conceptType: concept.type,
          promptLength: promptData.mainPrompt.length
        });

        return promptData;
      },
      { operationName: 'generateVideoPrompt', maxAttempts: 2 }
    );
  }

  /**
   * Video kalite kontrolü (thumbnail analizi)
   */
  async qualityCheckVideo(orderId, thumbnailBase64, originalAnalysis) {
    this._ensureInitialized();

    return withRetry(
      async () => {
        if (!thumbnailBase64) {
          logger.warn('No thumbnail provided for QC', { orderId });
          return { ...DEFAULT_QC_RESULT, issues: ['No thumbnail provided'] };
        }

        const prompt = `
Üretilen video thumbnail'ını orijinal ürün bilgileriyle karşılaştır ve kalite kontrolü yap.

ORİJİNAL ÜRÜN BİLGİLERİ:
${JSON.stringify(originalAnalysis || {}, null, 2)}

JSON formatında değerlendir:

{
  "passed": true,
  "overallScore": 8,
  "checks": {
    "productVisibility": { "score": 8, "note": "açıklama" },
    "colorAccuracy": { "score": 8, "note": "açıklama" },
    "professionalQuality": { "score": 8, "note": "açıklama" },
    "commercialViability": { "score": 8, "note": "açıklama" }
  },
  "issues": [],
  "recommendation": "approve"
}`;

        const result = await withTimeout(
          this.flashModel.generateContent([
            prompt,
            {
              inlineData: {
                data: thumbnailBase64,
                mimeType: 'image/jpeg'
              }
            }
          ]),
          config.gemini.conceptTimeoutMs,
          'qualityCheck'
        );

        const response = result.response;
        const text = response.text();

        this._trackUsage(orderId, response.usageMetadata, 'flash');

        const qcResult = extractJsonFromText(text, DEFAULT_QC_RESULT, 'qualityCheck');

        // Ensure required fields
        qcResult.passed = qcResult.passed === true;
        qcResult.overallScore = Number(qcResult.overallScore) || 0;

        logger.info('Video kalite kontrolü tamamlandı', {
          orderId,
          passed: qcResult.passed,
          score: qcResult.overallScore
        });

        return qcResult;
      },
      { operationName: 'qualityCheckVideo', maxAttempts: 2 }
    );
  }

  /**
   * Moderator karar mekanizması
   */
  async moderatorDecision(orderId, context, question) {
    this._ensureInitialized();

    return withRetry(
      async () => {
        const prompt = `
Sen Rejista sisteminin Moderator ajanısın. Görevin sistem koordinasyonu, kalite kontrolü ve bütçe yönetimidir.

MEVCUT DURUM:
${JSON.stringify(context, null, 2)}

SORU/KARAR GEREKLİ:
${question}

KURALLAR:
1. Sipariş başına maliyet limiti: $${config.costs.maxPerOrder}
2. Video süresi: ${config.video.durationSeconds} saniye
3. Her siparişte 3 farklı konsept üretilmeli
4. Kalite skoru minimum 7/10 olmalı

JSON formatında karar ver:

{
  "decision": "proceed/pause/retry/escalate/abort",
  "reasoning": "Kararın gerekçesi",
  "nextAction": "Yapılması gereken sonraki aksiyon",
  "priority": "high/medium/low",
  "estimatedCost": "Tahmini maliyet (varsa)",
  "warnings": ["Varsa uyarılar"]
}`;

        const result = await withTimeout(
          this.flashModel.generateContent(prompt),
          config.gemini.timeout || 20000,
          'moderatorDecision'
        );

        const response = result.response;
        const text = response.text();

        this._trackUsage(orderId, response.usageMetadata, 'flash');

        const decision = extractJsonFromText(text, null, 'moderatorDecision');

        // Parse başarısız olursa güvenli default döndür
        if (!decision || !decision.decision) {
          logger.warn('Failed to parse moderator decision, using safe default', { orderId });
          return DEFAULT_DECISION;
        }

        // Decision validation
        const validDecisions = ['proceed', 'pause', 'retry', 'escalate', 'abort'];
        if (!validDecisions.includes(decision.decision)) {
          logger.warn('Invalid decision value, defaulting to pause', {
            orderId,
            received: decision.decision
          });
          decision.decision = 'pause';
        }

        return decision;
      },
      { operationName: 'moderatorDecision', maxAttempts: 2 }
    );
  }
}

// Singleton instance
export const geminiService = new GeminiService();

export default geminiService;
