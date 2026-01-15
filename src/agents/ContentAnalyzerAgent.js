/**
 * Rejista - Content Analyzer Agent
 * Ürün görsellerini analiz eden uzman ajan
 *
 * Sorumluluklar:
 * - Ürün fotoğraflarını analiz et
 * - Renk paleti, obje listesi, mood çıkar
 * - Video konseptleri oluştur
 * - Teknik rapor hazırla
 */

import { BaseAgent } from './BaseAgent.js';
import { config } from '../config/index.js';
import { sheetsService } from '../services/googleSheets.js';
import { driveService } from '../services/googleDrive.js';
import { geminiService } from '../services/gemini.js';

export class ContentAnalyzerAgent extends BaseAgent {
  constructor() {
    super('ContentAnalyzer', {
      pollInterval: 5000,
      maxConcurrent: 2
    });
  }

  /**
   * Görev işle - override
   * @param {object} task - Görev
   * @returns {Promise<object>} - Sonuç
   */
  async processTask(task) {
    switch (task.type) {
      case 'analyze':
        return this.analyzeOrder(task);
      default:
        throw new Error(`Bilinmeyen görev tipi: ${task.type}`);
    }
  }

  /**
   * Sipariş analizini gerçekleştir
   * @param {object} task - Görev bilgileri
   * @returns {Promise<object>} - Analiz sonuçları
   */
  async analyzeOrder(task) {
    const { orderId, driveFolderId } = task;

    this.logger.info('Sipariş analizi başlıyor', { orderId });

    try {
      // 1. Drive'dan görselleri al
      const images = await this._getProductImages(driveFolderId);

      if (images.length === 0) {
        throw new Error('Analiz için görsel bulunamadı');
      }

      this.logger.info('Görseller alındı', { orderId, imageCount: images.length });

      // 2. Bütçe kontrolü
      if (!this.checkBudget(orderId, 0.30)) {
        throw new Error('Analiz için bütçe yetersiz');
      }

      // 3. Gemini ile görsel analizi
      const analysis = await geminiService.analyzeProductImages(orderId, images);

      this.logger.info('Görsel analizi tamamlandı', {
        orderId,
        category: analysis.product?.category,
        mood: analysis.mood?.primary
      });

      // 4. Video konseptleri oluştur
      const concepts = await geminiService.generateVideoConcepts(orderId, analysis);

      this.logger.info('Konseptler oluşturuldu', {
        orderId,
        conceptCount: concepts.length
      });

      // 5. Sonuçları Sheets'e kaydet
      await sheetsService.updateOrderStatus(
        orderId,
        config.orderStatuses.CONCEPT_READY,
        {
          analysisJson: analysis,
          concepts
        }
      );

      // 6. Log kaydet
      await this._logAction('analysis_completed', {
        orderId,
        imageCount: images.length,
        conceptCount: concepts.length,
        product: analysis.product
      }, 'success');

      return {
        orderId,
        analysis,
        concepts,
        imageCount: images.length
      };
    } catch (error) {
      this.logger.error('Analiz hatası', { orderId, error: error.message });

      // Siparişi hata durumuna al
      await sheetsService.updateOrderStatus(
        orderId,
        config.orderStatuses.FAILED,
        { notes: `Analiz hatası: ${error.message}` }
      );

      await this._logAction('analysis_failed', {
        orderId,
        error: error.message
      }, 'error');

      throw error;
    }
  }

  /**
   * Drive'dan ürün görsellerini al
   * @private
   * @param {string} folderId - Ana klasör ID
   * @returns {Promise<Array>} - Görseller
   */
  async _getProductImages(folderId) {
    try {
      // Önce "Gorseller" alt klasörünü bul
      const folders = await driveService.listFiles(folderId);
      const imagesFolder = folders.find(
        (f) => f.name.toLowerCase() === 'gorseller' || f.name.toLowerCase() === 'images'
      );

      if (imagesFolder) {
        return driveService.getImagesForAnalysis(imagesFolder.id);
      }

      // Alt klasör yoksa ana klasörden al
      return driveService.getImagesForAnalysis(folderId);
    } catch (error) {
      this.logger.error('Görsel alınamadı', { folderId, error: error.message });
      return [];
    }
  }

  /**
   * Analiz kalitesini değerlendir
   * @param {object} analysis - Analiz sonucu
   * @returns {object} - Kalite değerlendirmesi
   */
  evaluateAnalysisQuality(analysis) {
    const checks = {
      hasProduct: !!analysis.product?.name,
      hasColors: analysis.visual?.dominantColors?.length > 0,
      hasMood: !!analysis.mood?.primary,
      hasObjects: analysis.objects?.length > 0,
      hasSuggestions: !!analysis.videoSuggestions,
      qualityScore: analysis.qualityScore?.overall || 0
    };

    const passedChecks = Object.values(checks).filter((v) => v === true || v > 5).length;
    const totalChecks = Object.keys(checks).length;

    return {
      score: (passedChecks / totalChecks) * 10,
      checks,
      passed: passedChecks >= totalChecks * 0.7, // %70 geçme kriteri
      recommendation: passedChecks >= totalChecks * 0.7 ? 'proceed' : 'review'
    };
  }

  /**
   * Konseptlerin uygunluğunu kontrol et
   * @param {Array} concepts - Konseptler
   * @param {object} analysis - Ürün analizi
   * @returns {object} - Uygunluk değerlendirmesi
   */
  validateConcepts(concepts, analysis) {
    const validations = concepts.map((concept) => {
      const issues = [];

      // Sahne sayısı kontrolü
      if (!concept.keyScenes || concept.keyScenes.length < 3) {
        issues.push('Yetersiz sahne sayısı');
      }

      // Toplam süre kontrolü
      const totalDuration = concept.keyScenes?.reduce(
        (sum, scene) => sum + (parseInt(scene.duration) || 0),
        0
      ) || 0;

      if (totalDuration < config.video.durationSeconds * 0.8) {
        issues.push('Toplam süre yetersiz');
      }

      // Ürün odağı kontrolü
      const productFocused = concept.keyScenes?.some(
        (scene) => scene.focusElement?.toLowerCase().includes('product') ||
          scene.focusElement?.toLowerCase().includes('ürün')
      );

      if (!productFocused) {
        issues.push('Ürün odaklı sahne yok');
      }

      return {
        type: concept.type,
        name: concept.name,
        valid: issues.length === 0,
        issues
      };
    });

    const validCount = validations.filter((v) => v.valid).length;

    return {
      validations,
      allValid: validCount === concepts.length,
      validCount,
      totalCount: concepts.length
    };
  }

  /**
   * Yeniden analiz gerekli mi belirle
   * @param {object} analysis - Mevcut analiz
   * @param {Array} concepts - Mevcut konseptler
   * @returns {boolean} - Yeniden analiz gerekli mi
   */
  needsReanalysis(analysis, concepts) {
    const analysisQuality = this.evaluateAnalysisQuality(analysis);
    const conceptValidation = this.validateConcepts(concepts, analysis);

    // Analiz kalitesi düşükse veya konseptler geçersizse yeniden analiz
    return !analysisQuality.passed || !conceptValidation.allValid;
  }

  /**
   * Batch analiz (birden fazla sipariş)
   * @param {Array} orders - Sipariş listesi
   * @returns {Promise<Array>} - Sonuçlar
   */
  async batchAnalyze(orders) {
    const results = [];

    for (const order of orders) {
      this.addTask({
        id: `analyze_${order.orderId}`,
        type: 'analyze',
        orderId: order.orderId,
        driveFolderId: order.driveFolderId
      });
    }

    // Tüm görevlerin tamamlanmasını bekle
    return new Promise((resolve) => {
      const checkComplete = setInterval(() => {
        const pending = this.taskQueue.filter(
          (t) => t.status === 'pending' || t.status === 'processing'
        );

        if (pending.length === 0) {
          clearInterval(checkComplete);

          const completed = this.taskQueue.filter(
            (t) => t.status === 'completed' || t.status === 'failed'
          );

          resolve(completed.map((t) => ({
            orderId: t.orderId,
            status: t.status,
            result: t.result,
            error: t.error
          })));
        }
      }, 1000);
    });
  }
}

// Singleton instance
export const contentAnalyzerAgent = new ContentAnalyzerAgent();

export default contentAnalyzerAgent;
