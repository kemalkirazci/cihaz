/**
 * Rejista - Moderator Agent
 * Sistemin ana koordinatörü ve yöneticisi
 *
 * Sorumluluklar:
 * - Yeni siparişleri tespit et ve işleme al
 * - Ajanlar arası koordinasyon
 * - Kalite kontrolü ve onay
 * - Bütçe yönetimi
 * - Hata kurtarma
 */

import { BaseAgent } from './BaseAgent.js';
import { config } from '../config/index.js';
import { sheetsService } from '../services/googleSheets.js';
import { driveService } from '../services/googleDrive.js';
import { gmailService } from '../services/gmail.js';
import { geminiService } from '../services/gemini.js';
import { costTracker } from '../utils/costTracker.js';

export class ModeratorAgent extends BaseAgent {
  constructor() {
    super('Moderator', {
      pollInterval: config.agents.moderatorPollInterval
    });

    this.contentAnalyzer = null;
    this.productionAgents = [];
    this.activeOrders = new Map();
  }

  /**
   * Bağımlı ajanları ayarla
   * @param {ContentAnalyzerAgent} contentAnalyzer
   * @param {Array<ProductionAgent>} productionAgents
   */
  setAgents(contentAnalyzer, productionAgents) {
    this.contentAnalyzer = contentAnalyzer;
    this.productionAgents = productionAgents;

    this.logger.info('Bağımlı ajanlar ayarlandı', {
      contentAnalyzer: !!contentAnalyzer,
      productionAgentCount: productionAgents.length
    });
  }

  /**
   * Ana işleme döngüsü - override
   */
  async runLoop() {
    this.logger.info('Moderator döngüsü başlatıldı');

    while (this.status === 'working') {
      try {
        // 1. Yeni siparişleri kontrol et
        await this.checkForNewOrders();

        // 2. Analiz bekleyen siparişleri işle
        await this.processAnalysisPending();

        // 3. Üretim bekleyen siparişleri işle
        await this.processProductionPending();

        // 4. Kalite kontrol bekleyenleri işle
        await this.processQualityCheck();

        // 5. Teslimat bekleyenleri işle
        await this.processDeliveryPending();

        // 6. Bütçe ve sistem sağlığını kontrol et
        await this.healthCheck();

        // Poll interval
        await new Promise((resolve) => setTimeout(resolve, this.config.pollInterval));
      } catch (error) {
        this.logger.error('Moderator döngü hatası', { error: error.message });
        await this._logAction('loop_error', { error: error.message }, 'error');

        // Hata durumunda daha uzun bekle
        await new Promise((resolve) => setTimeout(resolve, config.agents.errorRecoveryDelayMs));
      }
    }
  }

  /**
   * Yeni siparişleri kontrol et
   */
  async checkForNewOrders() {
    try {
      // Gmail'den yeni Etsy siparişlerini ara
      const since = new Date();
      since.setHours(since.getHours() - 24); // Son 24 saat

      const emails = await gmailService.searchEtsyOrderEmails(since);

      for (const email of emails) {
        const orderInfo = gmailService.parseEtsyOrderEmail(email);

        if (orderInfo) {
          // Bu sipariş daha önce işlendi mi?
          const existingOrder = await sheetsService.getOrder(orderInfo.etsyOrderId);

          if (!existingOrder) {
            // Yeni sipariş - işleme al
            await this.initializeNewOrder(orderInfo, email.id);
          }
        }
      }
    } catch (error) {
      this.logger.error('Yeni sipariş kontrolü hatası', { error: error.message });
    }
  }

  /**
   * Yeni siparişi başlat
   * @param {object} orderInfo - Sipariş bilgileri
   * @param {string} emailId - Email ID
   */
  async initializeNewOrder(orderInfo, emailId) {
    this.logger.info('Yeni sipariş başlatılıyor', { etsyOrderId: orderInfo.etsyOrderId });

    try {
      // 1. Drive klasörü oluştur
      const folder = await driveService.createOrderFolder(
        orderInfo.etsyOrderId,
        orderInfo.customerName
      );

      // 2. Sheets'e ekle
      const orderId = await sheetsService.addOrder({
        orderId: `ORD-${orderInfo.etsyOrderId}`,
        customerName: orderInfo.customerName,
        customerEmail: orderInfo.customerEmail,
        etsyOrderId: orderInfo.etsyOrderId,
        productName: orderInfo.productName,
        driveFolderId: folder.folderId,
        notes: `Email ID: ${emailId}`
      });

      // 3. Aktif siparişlere ekle
      this.activeOrders.set(orderId, {
        ...orderInfo,
        folderId: folder.folderId,
        subfolders: folder.subfolders,
        stage: 'initialized'
      });

      // 4. Email'i işlenmiş olarak işaretle
      await gmailService.markAsProcessed(emailId);

      await this._logAction('order_initialized', {
        orderId,
        etsyOrderId: orderInfo.etsyOrderId,
        folderId: folder.folderId
      }, 'success');

      this.logger.info('Sipariş başlatıldı', { orderId });
    } catch (error) {
      this.logger.error('Sipariş başlatma hatası', {
        etsyOrderId: orderInfo.etsyOrderId,
        error: error.message
      });
    }
  }

  /**
   * Analiz bekleyen siparişleri işle
   */
  async processAnalysisPending() {
    const pendingOrders = await sheetsService.getOrdersByStatus(config.orderStatuses.PENDING);

    for (const order of pendingOrders) {
      // Bütçe kontrolü
      if (!this.checkBudget(order.orderId, 0.50)) {
        this.logger.warn('Bütçe yetersiz, sipariş atlanıyor', { orderId: order.orderId });
        continue;
      }

      // Durumu güncelle
      await sheetsService.updateOrderStatus(order.orderId, config.orderStatuses.ANALYZING);

      // Content Analyzer'a gönder
      if (this.contentAnalyzer) {
        this.contentAnalyzer.addTask({
          id: `analyze_${order.orderId}`,
          type: 'analyze',
          orderId: order.orderId,
          driveFolderId: order.driveFolderId
        });

        this.logger.info('Sipariş analize gönderildi', { orderId: order.orderId });
      }
    }
  }

  /**
   * Üretim bekleyen siparişleri işle
   */
  async processProductionPending() {
    const readyOrders = await sheetsService.getOrdersByStatus(config.orderStatuses.CONCEPT_READY);

    for (const order of readyOrders) {
      if (!order.concepts || order.concepts.length === 0) {
        this.logger.warn('Konsept bulunamadı, atlanıyor', { orderId: order.orderId });
        continue;
      }

      // Bütçe kontrolü (video üretimi pahalı)
      if (!this.checkBudget(order.orderId, 2.00)) {
        this.logger.warn('Video üretimi için bütçe yetersiz', { orderId: order.orderId });
        continue;
      }

      // Durumu güncelle
      await sheetsService.updateOrderStatus(order.orderId, config.orderStatuses.PRODUCING);

      // Her konsept için bir Production Agent'a görev ver
      const concepts = order.concepts;

      for (let i = 0; i < concepts.length && i < this.productionAgents.length; i++) {
        const agent = this.productionAgents[i];
        const concept = concepts[i];

        agent.addTask({
          id: `produce_${order.orderId}_${concept.type}`,
          type: 'produce',
          orderId: order.orderId,
          concept,
          analysis: order.analysisJson,
          driveFolderId: order.driveFolderId
        });

        this.logger.info('Üretim görevi atandı', {
          orderId: order.orderId,
          agent: agent.name,
          concept: concept.type
        });
      }
    }
  }

  /**
   * Kalite kontrol bekleyenleri işle
   */
  async processQualityCheck() {
    const qcOrders = await sheetsService.getOrdersByStatus(config.orderStatuses.QUALITY_CHECK);

    for (const order of qcOrders) {
      try {
        // Tüm videolar üretildi mi kontrol et
        const videoUrls = order.videoUrls || [];

        if (videoUrls.length < 3) {
          // Henüz tüm videolar hazır değil
          continue;
        }

        // Moderator karar al
        const decision = await geminiService.moderatorDecision(
          order.orderId,
          {
            order,
            videoCount: videoUrls.length,
            totalCost: costTracker.checkOrderBudget(order.orderId)
          },
          'Tüm videolar üretildi. Kalite yeterli mi, teslimata geçilmeli mi?'
        );

        if (decision.decision === 'proceed') {
          // Teslimata geç
          await sheetsService.updateOrderStatus(order.orderId, config.orderStatuses.DELIVERING);
          this.logger.info('Sipariş teslimata hazır', { orderId: order.orderId });
        } else if (decision.decision === 'retry') {
          // Yeniden üretim gerekli
          await sheetsService.updateOrderStatus(
            order.orderId,
            config.orderStatuses.CONCEPT_READY,
            { notes: `Yeniden üretim: ${decision.reasoning}` }
          );
        } else {
          // Sorun var
          await sheetsService.updateOrderStatus(
            order.orderId,
            config.orderStatuses.FAILED,
            { notes: decision.reasoning }
          );
        }
      } catch (error) {
        this.logger.error('Kalite kontrol hatası', {
          orderId: order.orderId,
          error: error.message
        });
      }
    }
  }

  /**
   * Teslimat bekleyenleri işle
   */
  async processDeliveryPending() {
    const deliveryOrders = await sheetsService.getOrdersByStatus(config.orderStatuses.DELIVERING);

    for (const order of deliveryOrders) {
      try {
        // Drive linki oluştur
        const folderLink = await driveService.shareWithEmail(
          order.driveFolderId,
          order.customerEmail,
          'reader'
        );

        // Müşteriye bildirim gönder
        await gmailService.sendDeliveryNotification(
          order.customerEmail,
          order.customerName,
          order.orderId,
          folderLink
        );

        // Maliyet raporunu al
        const costReport = costTracker.getOrderReport(order.orderId);

        // Siparişi tamamla
        await sheetsService.updateOrderStatus(
          order.orderId,
          config.orderStatuses.COMPLETED,
          { totalCost: costReport.total }
        );

        // Maliyet takibini temizle
        costTracker.clearOrder(order.orderId);

        await this._logAction('order_completed', {
          orderId: order.orderId,
          totalCost: costReport.total.toFixed(4),
          deliveredTo: order.customerEmail
        }, 'success');

        this.logger.info('Sipariş tamamlandı', {
          orderId: order.orderId,
          totalCost: costReport.total.toFixed(4)
        });
      } catch (error) {
        this.logger.error('Teslimat hatası', {
          orderId: order.orderId,
          error: error.message
        });

        // Hata bildirimi gönder
        await gmailService.sendErrorNotification(
          order.orderId,
          error,
          config.workspace.gmailUser
        );
      }
    }
  }

  /**
   * Sistem sağlık kontrolü
   */
  async healthCheck() {
    try {
      const stats = costTracker.getGlobalStats();

      // Günlük bütçe uyarısı
      if (stats.dailyBudget.percentage > 80) {
        this.logger.warn('Günlük bütçe %80 aşıldı', {
          current: stats.dailyTotal.toFixed(2),
          limit: stats.dailyBudget.limit
        });
      }

      // Aylık bütçe uyarısı
      if (stats.monthlyBudget.percentage > 90) {
        this.logger.error('Aylık bütçe kritik seviyede!', {
          current: stats.monthlyTotal.toFixed(2),
          limit: stats.monthlyBudget.limit
        });

        // Sistemi duraklat
        this.pause();
      }

      // Ajan durumlarını kontrol et
      const agentStatuses = [
        this.contentAnalyzer?.getStatus(),
        ...this.productionAgents.map((a) => a.getStatus())
      ].filter(Boolean);

      const failedAgents = agentStatuses.filter((s) => s.status === 'error');

      if (failedAgents.length > 0) {
        this.logger.warn('Hatalı ajanlar tespit edildi', {
          agents: failedAgents.map((a) => a.name)
        });
      }

      // Dashboard için metrikleri emit et
      this.emit('healthCheck', {
        budget: stats,
        agents: agentStatuses,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Sağlık kontrolü hatası', { error: error.message });
    }
  }

  /**
   * Siparişi manuel olarak işleme al
   * @param {string} orderId - Sipariş ID
   * @param {string} targetStatus - Hedef durum
   */
  async manualIntervention(orderId, targetStatus) {
    this.logger.info('Manuel müdahale', { orderId, targetStatus });

    await sheetsService.updateOrderStatus(orderId, targetStatus, {
      notes: `Manuel müdahale: ${new Date().toISOString()}`
    });

    await this._logAction('manual_intervention', {
      orderId,
      targetStatus
    }, 'success');
  }

  /**
   * Dashboard için özet bilgiler
   */
  async getDashboardData() {
    const stats = await sheetsService.getDashboardStats();
    const budgetStats = costTracker.getGlobalStats();

    const agentStatuses = [
      { name: 'Moderator', ...this.getStatus() },
      this.contentAnalyzer ? { name: 'ContentAnalyzer', ...this.contentAnalyzer.getStatus() } : null,
      ...this.productionAgents.map((a) => ({ name: a.name, ...a.getStatus() }))
    ].filter(Boolean);

    return {
      orders: stats,
      budget: budgetStats,
      agents: agentStatuses,
      system: {
        uptime: this.metrics.startTime ? Date.now() - this.metrics.startTime.getTime() : 0,
        status: this.status
      }
    };
  }
}

// Singleton instance
export const moderatorAgent = new ModeratorAgent();

export default moderatorAgent;
