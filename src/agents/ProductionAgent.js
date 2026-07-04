/**
 * Rejista - Production Agent
 * Video üretim uzmanı - kreatif direktör rolü
 *
 * Sorumluluklar:
 * - Video üretim promptları yaz
 * - Vertex AI ile video üret
 * - Kalite kontrolü yap
 * - Sonuçları kaydet
 */

import { BaseAgent } from './BaseAgent.js';
import { config } from '../config/index.js';
import { sheetsService } from '../services/googleSheets.js';
import { driveService } from '../services/googleDrive.js';
import { geminiService } from '../services/gemini.js';
import { vertexAIService } from '../services/vertexAI.js';
import { costTracker } from '../utils/costTracker.js';

export class ProductionAgent extends BaseAgent {
  constructor(conceptType) {
    super(`Production_${conceptType}`, {
      pollInterval: config.agents.productionPollInterval,
      maxConcurrent: 1
    });

    this.conceptType = conceptType; // ENERGETIC, MINIMAL, CINEMATIC
    this.specialization = config.conceptTypes[conceptType] || {};
  }

  /**
   * Görev işle - override
   * @param {object} task - Görev
   * @returns {Promise<object>} - Sonuç
   */
  async processTask(task) {
    switch (task.type) {
      case 'produce':
        return this.produceVideo(task);
      case 'regenerate':
        return this.regenerateVideo(task);
      default:
        throw new Error(`Bilinmeyen görev tipi: ${task.type}`);
    }
  }

  /**
   * Video üret
   * @param {object} task - Görev bilgileri
   * @returns {Promise<object>} - Üretim sonucu
   */
  async produceVideo(task) {
    const { orderId, concept, analysis, driveFolderId } = task;

    this.logger.info('Video üretimi başlıyor', {
      orderId,
      concept: concept.type
    });

    try {
      // 1. Bütçe kontrolü
      const estimatedCost = config.video.durationSeconds * config.costs.pricing.veoPerSecond;

      if (!this.checkBudget(orderId, estimatedCost)) {
        throw new Error('Video üretimi için bütçe yetersiz');
      }

      // 2. Video promptu oluştur
      const promptData = await geminiService.generateVideoPrompt(orderId, concept, analysis);
      promptData.conceptType = concept.type;

      this.logger.info('Video promptu hazırlandı', {
        orderId,
        promptLength: promptData.mainPrompt?.length
      });

      // 3. Video üret
      const videoResult = await vertexAIService.generateVideo(orderId, promptData);

      this.logger.info('Video üretildi', {
        orderId,
        videoId: videoResult.videoId,
        fallbackMode: videoResult.fallbackMode
      });

      // 4. Kalite kontrol (thumbnail varsa)
      let qcResult = { passed: true, overallScore: 8 };

      if (videoResult.thumbnailBase64) {
        qcResult = await geminiService.qualityCheckVideo(
          orderId,
          videoResult.thumbnailBase64,
          analysis
        );

        this.logger.info('Kalite kontrolü tamamlandı', {
          orderId,
          passed: qcResult.passed,
          score: qcResult.overallScore
        });
      }

      // 5. Video dosyasını Drive'a yükle (eğer varsa)
      let uploadResult = null;

      if (videoResult.videoUrl || videoResult.thumbnailBase64) {
        // Video klasörünü bul
        const folders = await driveService.listFiles(driveFolderId);
        const videosFolder = folders.find(
          (f) => f.name.toLowerCase() === 'videolar' || f.name.toLowerCase() === 'videos'
        );

        const targetFolderId = videosFolder?.id || driveFolderId;
        const videoName = `${orderId}_${concept.type}_${Date.now()}.mp4`;

        // Fallback modda thumbnail'ı yükle
        if (videoResult.fallbackMode && videoResult.thumbnailBase64) {
          const thumbnailBuffer = Buffer.from(videoResult.thumbnailBase64, 'base64');
          uploadResult = await driveService.uploadFile(
            targetFolderId,
            `${orderId}_${concept.type}_preview.png`,
            thumbnailBuffer,
            'image/png'
          );
        }

        // Gerçek video varsa yükle
        // Not: Gerçek implementasyonda video binary'si yüklenecek
      }

      // 6. Sonuçları güncelle
      const existingOrder = await sheetsService.getOrder(orderId);
      const existingVideos = existingOrder?.videoUrls || [];

      existingVideos.push({
        conceptType: concept.type,
        videoId: videoResult.videoId,
        status: qcResult.passed ? 'approved' : 'review_needed',
        qcScore: qcResult.overallScore,
        uploadResult,
        createdAt: new Date().toISOString()
      });

      // Tüm konseptler tamamlandı mı?
      const newStatus = existingVideos.length >= 3
        ? config.orderStatuses.QUALITY_CHECK
        : config.orderStatuses.PRODUCING;

      await sheetsService.updateOrderStatus(orderId, newStatus, {
        videoUrls: existingVideos
      });

      // 7. Log kaydet
      await this._logAction('video_produced', {
        orderId,
        conceptType: concept.type,
        videoId: videoResult.videoId,
        qcPassed: qcResult.passed,
        qcScore: qcResult.overallScore
      }, 'success');

      return {
        orderId,
        conceptType: concept.type,
        videoResult,
        qcResult,
        uploadResult
      };
    } catch (error) {
      this.logger.error('Video üretim hatası', {
        orderId,
        concept: concept.type,
        error: error.message
      });

      await this._logAction('video_production_failed', {
        orderId,
        conceptType: concept.type,
        error: error.message
      }, 'error');

      throw error;
    }
  }

  /**
   * Video yeniden üret
   * @param {object} task - Görev bilgileri
   * @returns {Promise<object>} - Yeni üretim sonucu
   */
  async regenerateVideo(task) {
    const { orderId, concept, analysis, feedback } = task;

    this.logger.info('Video yeniden üretimi başlıyor', {
      orderId,
      concept: concept.type,
      feedback
    });

    // Feedback'i konsepte ekle
    const enhancedConcept = {
      ...concept,
      regenerationFeedback: feedback,
      previousAttempt: true
    };

    return this.produceVideo({
      ...task,
      concept: enhancedConcept
    });
  }

  /**
   * Konsept optimizasyonu
   * @param {object} concept - Orijinal konsept
   * @param {object} analysis - Ürün analizi
   * @returns {object} - Optimize edilmiş konsept
   */
  optimizeConcept(concept, analysis) {
    // Ajan uzmanlığına göre konsepti optimize et
    const optimized = { ...concept };

    switch (this.conceptType) {
      case 'ENERGETIC':
        // Daha dinamik geçişler ve hızlı tempo
        optimized.visualStyle = {
          ...optimized.visualStyle,
          pace: 'fast',
          transitions: 'dynamic cuts, zoom effects, quick pans'
        };
        optimized.musicMood = 'upbeat electronic, energetic pop';
        break;

      case 'MINIMAL':
        // Temiz, sade ve zarif
        optimized.visualStyle = {
          ...optimized.visualStyle,
          pace: 'slow',
          transitions: 'smooth fades, gentle dissolves'
        };
        optimized.musicMood = 'ambient, soft piano, minimal beats';
        break;

      case 'CINEMATIC':
        // Dramatik ve film kalitesinde
        optimized.visualStyle = {
          ...optimized.visualStyle,
          pace: 'medium',
          transitions: 'cinematic wipes, slow motion, lens flares'
        };
        optimized.musicMood = 'orchestral, dramatic strings, epic';
        break;
    }

    // Ürün kategorisine göre ayarlamalar
    if (analysis.product?.category === 'jewelry') {
      optimized.keyScenes = optimized.keyScenes?.map((scene) => ({
        ...scene,
        lighting: 'dramatic spotlight, sparkle highlights',
        cameraAngle: 'macro close-up, rotating showcase'
      }));
    }

    return optimized;
  }

  /**
   * Video kalite skorunu hesapla
   * @param {object} qcResult - Kalite kontrol sonucu
   * @returns {object} - Skor detayları
   */
  calculateQualityScore(qcResult) {
    if (!qcResult || !qcResult.checks) {
      return { score: 0, grade: 'F', recommendation: 'reject' };
    }

    const weights = {
      productVisibility: 0.3,
      colorAccuracy: 0.2,
      professionalQuality: 0.25,
      commercialViability: 0.25
    };

    let weightedScore = 0;

    for (const [check, weight] of Object.entries(weights)) {
      const checkScore = qcResult.checks[check]?.score || 0;
      weightedScore += checkScore * weight;
    }

    const grade =
      weightedScore >= 9 ? 'A+' :
        weightedScore >= 8 ? 'A' :
          weightedScore >= 7 ? 'B' :
            weightedScore >= 6 ? 'C' :
              weightedScore >= 5 ? 'D' : 'F';

    const recommendation =
      weightedScore >= 7 ? 'approve' :
        weightedScore >= 5 ? 'revise' : 'reject';

    return {
      score: weightedScore,
      grade,
      recommendation,
      breakdown: qcResult.checks
    };
  }

  /**
   * Üretim istatistikleri
   * @returns {object} - İstatistikler
   */
  getProductionStats() {
    const baseStats = this.getStatus();

    return {
      ...baseStats,
      conceptType: this.conceptType,
      specialization: this.specialization,
      averageProductionTime: this.metrics.averageProcessingTime,
      successRate: this.metrics.tasksCompleted > 0
        ? ((this.metrics.tasksCompleted / (this.metrics.tasksCompleted + this.metrics.tasksFailed)) * 100).toFixed(1)
        : 0
    };
  }
}

/**
 * Production Agent Factory
 * 3 farklı konsept tipi için ajanlar oluşturur
 */
export function createProductionAgents() {
  return [
    new ProductionAgent('ENERGETIC'),
    new ProductionAgent('MINIMAL'),
    new ProductionAgent('CINEMATIC')
  ];
}

export default ProductionAgent;
