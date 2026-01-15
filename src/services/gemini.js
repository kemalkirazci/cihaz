/**
 * Rejista - Gemini AI Servisi
 * Görüntü analizi, strateji oluşturma ve prompt üretimi
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { costTracker } from '../utils/costTracker.js';
import { withRetry, withTimeout } from '../utils/retry.js';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.proModel = null;
    this.flashModel = null;
  }

  /**
   * Servisi başlat
   */
  async initialize() {
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
   * Ürün görsellerini analiz et
   * @param {string} orderId - Sipariş ID (maliyet takibi için)
   * @param {Array} images - Base64 encoded görseller [{content, mimeType, name}]
   * @returns {object} - Analiz sonuçları
   */
  async analyzeProductImages(orderId, images) {
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
    "recommendedDuration": "Önerilen video süresi (saniye)",
    "aspectRatioRecommendation": "16:9 / 9:16 / 1:1"
  },
  "qualityScore": {
    "overall": 1-10,
    "sharpness": 1-10,
    "composition": 1-10,
    "commercialPotential": 1-10
  }
}
`;

        // Görselleri model formatına çevir
        const imageParts = images.map((img) => ({
          inlineData: {
            data: img.content,
            mimeType: img.mimeType
          }
        }));

        const result = await withTimeout(
          this.proModel.generateContent([prompt, ...imageParts]),
          60000,
          'imageAnalysis'
        );

        const response = result.response;
        const text = response.text();

        // Token kullanımını kaydet
        const usage = response.usageMetadata;
        if (usage) {
          costTracker.addCost(orderId, 'gemini_pro_input', usage.promptTokenCount || 0);
          costTracker.addCost(orderId, 'gemini_pro_output', usage.candidatesTokenCount || 0);
        }

        // JSON'u parse et
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Geçerli JSON yanıtı alınamadı');
        }

        const analysis = JSON.parse(jsonMatch[0]);

        logger.info('Görsel analizi tamamlandı', {
          orderId,
          imageCount: images.length,
          category: analysis.product?.category
        });

        return analysis;
      },
      { operationName: 'analyzeProductImages' }
    );
  }

  /**
   * Video konseptleri oluştur
   * @param {string} orderId - Sipariş ID
   * @param {object} analysis - Görsel analiz sonuçları
   * @returns {Array} - 3 farklı konsept
   */
  async generateVideoConcepts(orderId, analysis) {
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
        "pace": "fast/medium/slow",
        "cameraMovement": "Kamera hareketi türü"
      },
      "musicMood": "Müzik türü/mood",
      "keyScenes": [
        {
          "order": 1,
          "duration": "saniye",
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
      "name": "Minimal",
      ...
    },
    {
      "type": "CINEMATIC",
      "name": "Sinematik",
      ...
    }
  ]
}

Her konsept için en az 4 sahne tanımla. Toplam video süresi ${config.video.durationSeconds} saniye olmalı.
`;

        const result = await withTimeout(
          this.proModel.generateContent(prompt),
          45000,
          'generateConcepts'
        );

        const response = result.response;
        const text = response.text();

        // Token kullanımını kaydet
        const usage = response.usageMetadata;
        if (usage) {
          costTracker.addCost(orderId, 'gemini_pro_input', usage.promptTokenCount || 0);
          costTracker.addCost(orderId, 'gemini_pro_output', usage.candidatesTokenCount || 0);
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Geçerli konsept JSON yanıtı alınamadı');
        }

        const conceptsData = JSON.parse(jsonMatch[0]);

        logger.info('Video konseptleri oluşturuldu', {
          orderId,
          conceptCount: conceptsData.concepts?.length || 0
        });

        return conceptsData.concepts;
      },
      { operationName: 'generateVideoConcepts' }
    );
  }

  /**
   * Video üretim promptu oluştur (Veo 2 için)
   * @param {string} orderId - Sipariş ID
   * @param {object} concept - Video konsepti
   * @param {object} analysis - Ürün analizi
   * @returns {object} - Video prompt ve parametreleri
   */
  async generateVideoPrompt(orderId, concept, analysis) {
    return withRetry(
      async () => {
        const prompt = `
Sen bir AI video üretim sistemleri için profesyonel prompt mühendisisin. Google Veo 2 video üretim modeli için optimize edilmiş bir prompt yaz.

ÜRÜN BİLGİLERİ:
${JSON.stringify(analysis.product, null, 2)}

GÖRSEL ÖZELLİKLER:
${JSON.stringify(analysis.visual, null, 2)}

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
}

PROMPT YAZIM KURALLARI:
1. İngilizce yaz
2. Detaylı görsel açıklamalar kullan
3. Hareket ve kamera hareketlerini belirt
4. Aydınlatma ve atmosferi tanımla
5. Ürünün özelliklerini vurgula
6. Profesyonel ticari video kalitesi hedefle
`;

        // Flash model kullan - daha ucuz
        const result = await withTimeout(
          this.flashModel.generateContent(prompt),
          30000,
          'generateVideoPrompt'
        );

        const response = result.response;
        const text = response.text();

        // Token kullanımını kaydet
        const usage = response.usageMetadata;
        if (usage) {
          costTracker.addCost(orderId, 'gemini_flash_input', usage.promptTokenCount || 0);
          costTracker.addCost(orderId, 'gemini_flash_output', usage.candidatesTokenCount || 0);
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Geçerli prompt JSON yanıtı alınamadı');
        }

        const promptData = JSON.parse(jsonMatch[0]);

        logger.info('Video promptu oluşturuldu', {
          orderId,
          conceptType: concept.type,
          promptLength: promptData.mainPrompt?.length || 0
        });

        return promptData;
      },
      { operationName: 'generateVideoPrompt' }
    );
  }

  /**
   * Video kalite kontrolü (thumbnail analizi)
   * @param {string} orderId - Sipariş ID
   * @param {string} thumbnailBase64 - Video thumbnail
   * @param {object} originalAnalysis - Orijinal ürün analizi
   * @returns {object} - Kalite kontrol sonucu
   */
  async qualityCheckVideo(orderId, thumbnailBase64, originalAnalysis) {
    return withRetry(
      async () => {
        const prompt = `
Üretilen video thumbnail'ını orijinal ürün bilgileriyle karşılaştır ve kalite kontrolü yap.

ORİJİNAL ÜRÜN BİLGİLERİ:
${JSON.stringify(originalAnalysis, null, 2)}

JSON formatında değerlendir:

{
  "passed": true/false,
  "overallScore": 1-10,
  "checks": {
    "productVisibility": { "score": 1-10, "note": "açıklama" },
    "colorAccuracy": { "score": 1-10, "note": "açıklama" },
    "professionalQuality": { "score": 1-10, "note": "açıklama" },
    "commercialViability": { "score": 1-10, "note": "açıklama" }
  },
  "issues": ["varsa sorunlar listesi"],
  "recommendation": "approve/revise/reject"
}
`;

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
          30000,
          'qualityCheck'
        );

        const response = result.response;
        const text = response.text();

        const usage = response.usageMetadata;
        if (usage) {
          costTracker.addCost(orderId, 'gemini_flash_input', usage.promptTokenCount || 0);
          costTracker.addCost(orderId, 'gemini_flash_output', usage.candidatesTokenCount || 0);
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Geçerli QC JSON yanıtı alınamadı');
        }

        const qcResult = JSON.parse(jsonMatch[0]);

        logger.info('Video kalite kontrolü tamamlandı', {
          orderId,
          passed: qcResult.passed,
          score: qcResult.overallScore
        });

        return qcResult;
      },
      { operationName: 'qualityCheckVideo' }
    );
  }

  /**
   * Moderator karar mekanizması
   * @param {string} orderId - Sipariş ID
   * @param {object} context - Mevcut durum ve veriler
   * @param {string} question - Karar gerektiren soru
   * @returns {object} - Karar ve gerekçe
   */
  async moderatorDecision(orderId, context, question) {
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
}
`;

        const result = await withTimeout(
          this.flashModel.generateContent(prompt),
          20000,
          'moderatorDecision'
        );

        const response = result.response;
        const text = response.text();

        const usage = response.usageMetadata;
        if (usage) {
          costTracker.addCost(orderId, 'gemini_flash_input', usage.promptTokenCount || 0);
          costTracker.addCost(orderId, 'gemini_flash_output', usage.candidatesTokenCount || 0);
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            decision: 'proceed',
            reasoning: 'Varsayılan karar',
            nextAction: 'continue',
            priority: 'medium',
            warnings: []
          };
        }

        return JSON.parse(jsonMatch[0]);
      },
      { operationName: 'moderatorDecision' }
    );
  }
}

// Singleton instance
export const geminiService = new GeminiService();

export default geminiService;
