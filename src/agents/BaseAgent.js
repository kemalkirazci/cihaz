/**
 * Rejista - Base Agent Sınıfı
 * Tüm ajanların temel yapısı ve ortak fonksiyonları
 */

import { createAgentLogger } from '../utils/logger.js';
import { sheetsService } from '../services/googleSheets.js';
import { costTracker } from '../utils/costTracker.js';
import { config as appConfig } from '../config/index.js';
import { EventEmitter } from 'events';

export class BaseAgent extends EventEmitter {
  constructor(name, agentConfig = {}) {
    super();

    this.name = name;
    this.logger = createAgentLogger(name);
    this.status = 'idle'; // idle, working, paused, error
    this.currentTask = null;
    this.taskQueue = [];
    this.processedCount = 0;
    this.errorCount = 0;
    this.config = {
      maxConcurrent: 1,
      pollInterval: appConfig.agents?.defaultPollInterval || 5000,
      ...agentConfig
    };

    // Metriks
    this.metrics = {
      startTime: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Ajanı başlat
   */
  async start() {
    this.logger.info('Ajan başlatılıyor');
    this.status = 'working';
    this.metrics.startTime = new Date();

    await this._logAction('start', { status: 'Ajan aktif' }, 'success');

    this.emit('started', { agent: this.name });
  }

  /**
   * Ajanı durdur
   */
  async stop() {
    this.logger.info('Ajan durduruluyor');
    this.status = 'idle';

    await this._logAction('stop', { status: 'Ajan durduruldu' }, 'success');

    this.emit('stopped', { agent: this.name });
  }

  /**
   * Ajanı geçici olarak duraklat
   */
  pause() {
    this.logger.info('Ajan duraklatıldı');
    this.status = 'paused';
    this.emit('paused', { agent: this.name });
  }

  /**
   * Duraklamış ajanı devam ettir
   */
  resume() {
    this.logger.info('Ajan devam ediyor');
    this.status = 'working';
    this.emit('resumed', { agent: this.name });
  }

  /**
   * Görev ekle
   * @param {object} task - Görev bilgileri
   */
  addTask(task) {
    this.taskQueue.push({
      ...task,
      addedAt: new Date(),
      status: 'pending'
    });

    this.logger.debug('Görev eklendi', { taskId: task.id, queueLength: this.taskQueue.length });
    this.emit('taskAdded', { agent: this.name, task });
  }

  /**
   * Sıradaki görevi al
   * @returns {object|null} - Görev veya null
   */
  getNextTask() {
    const task = this.taskQueue.find((t) => t.status === 'pending');
    if (task) {
      task.status = 'processing';
      task.startedAt = new Date();
    }
    return task;
  }

  /**
   * Görevi tamamla
   * @param {object} task - Görev
   * @param {object} result - Sonuç
   */
  completeTask(task, result) {
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    const processingTime = task.completedAt - task.startedAt;
    this.metrics.tasksCompleted++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime =
      this.metrics.totalProcessingTime / this.metrics.tasksCompleted;

    this.processedCount++;

    this.logger.info('Görev tamamlandı', {
      taskId: task.id,
      processingTime: `${processingTime}ms`
    });

    this.emit('taskCompleted', { agent: this.name, task, result });
  }

  /**
   * Görev hatası
   * @param {object} task - Görev
   * @param {Error} error - Hata
   */
  failTask(task, error) {
    task.status = 'failed';
    task.failedAt = new Date();
    task.error = error.message;

    this.metrics.tasksFailed++;
    this.errorCount++;

    this.logger.error('Görev başarısız', {
      taskId: task.id,
      error: error.message
    });

    this.emit('taskFailed', { agent: this.name, task, error });
  }

  /**
   * Aksiyon logla (Sheets'e)
   * @protected
   */
  async _logAction(action, detail, status) {
    try {
      await sheetsService.addAgentLog(
        this.name,
        this.currentTask?.orderId || null,
        action,
        detail,
        status
      );
    } catch (error) {
      this.logger.warn('Log kaydedilemedi', { error: error.message });
    }
  }

  /**
   * Bütçe kontrolü
   * @param {string} orderId - Sipariş ID
   * @param {number} estimatedCost - Tahmini maliyet
   * @returns {boolean} - Devam edilebilir mi
   */
  checkBudget(orderId, estimatedCost = 0) {
    const budget = costTracker.canProceed(orderId, estimatedCost);

    if (!budget.canProceed) {
      this.logger.warn('Bütçe limiti aşılıyor', {
        orderId,
        estimatedCost,
        orderRemaining: budget.orderBudget.remaining
      });
    }

    return budget.canProceed;
  }

  /**
   * Ajan durumunu al
   * @returns {object} - Durum bilgileri
   */
  getStatus() {
    return {
      name: this.name,
      status: this.status,
      currentTask: this.currentTask?.id || null,
      queueLength: this.taskQueue.filter((t) => t.status === 'pending').length,
      metrics: this.metrics,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      uptime: this.metrics.startTime
        ? Date.now() - this.metrics.startTime.getTime()
        : 0
    };
  }

  /**
   * Görev işleme - Alt sınıflarda override edilecek
   * @abstract
   * @param {object} task - Görev
   * @returns {Promise<object>} - Sonuç
   */
  async processTask(task) {
    throw new Error('processTask metodu alt sınıfta implement edilmeli');
  }

  /**
   * Ana işleme döngüsü
   */
  async runLoop() {
    while (this.status === 'working') {
      try {
        const task = this.getNextTask();

        if (task) {
          this.currentTask = task;

          try {
            const result = await this.processTask(task);
            this.completeTask(task, result);
          } catch (error) {
            this.failTask(task, error);
          }

          this.currentTask = null;
        }

        // Poll interval
        await new Promise((resolve) => setTimeout(resolve, this.config.pollInterval));
      } catch (error) {
        this.logger.error('Loop hatası', { error: error.message });
        this.status = 'error';
        this.emit('error', { agent: this.name, error });
      }
    }
  }
}

export default BaseAgent;
