/**
 * Rejista - Maliyet Takip Sistemi
 * Her operasyonun maliyetini izler ve bütçe kontrolü yapar
 */

import { config } from '../config/index.js';
import { logger } from './logger.js';

class CostTracker {
  constructor() {
    this.orderCosts = new Map(); // orderId -> {items: [], total: number}
    this.dailyTotal = 0;
    this.monthlyTotal = 0;
    this.lastDailyReset = new Date().toDateString();
    this.lastMonthlyReset = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  }

  /**
   * Günlük/aylık sayaçları sıfırla
   */
  _checkResets() {
    const today = new Date().toDateString();
    const thisMonth = `${new Date().getFullYear()}-${new Date().getMonth()}`;

    if (this.lastDailyReset !== today) {
      logger.info('Günlük maliyet sayacı sıfırlandı', {
        previousTotal: this.dailyTotal
      });
      this.dailyTotal = 0;
      this.lastDailyReset = today;
    }

    if (this.lastMonthlyReset !== thisMonth) {
      logger.info('Aylık maliyet sayacı sıfırlandı', {
        previousTotal: this.monthlyTotal
      });
      this.monthlyTotal = 0;
      this.lastMonthlyReset = thisMonth;
    }
  }

  /**
   * Maliyet ekle
   * @param {string} orderId - Sipariş ID
   * @param {string} type - Maliyet tipi (gemini_input, gemini_output, video_render, storage)
   * @param {number} amount - Miktar (token sayısı veya saniye)
   * @returns {object} - Maliyet detayları
   */
  addCost(orderId, type, amount) {
    this._checkResets();

    const pricing = config.costs.pricing;
    let cost = 0;
    let unit = '';

    switch (type) {
      case 'gemini_pro_input':
        cost = (amount / 1000) * pricing.geminiProInputPer1k;
        unit = 'tokens';
        break;
      case 'gemini_pro_output':
        cost = (amount / 1000) * pricing.geminiProOutputPer1k;
        unit = 'tokens';
        break;
      case 'gemini_flash_input':
        cost = (amount / 1000) * pricing.geminiFlashInputPer1k;
        unit = 'tokens';
        break;
      case 'gemini_flash_output':
        cost = (amount / 1000) * pricing.geminiFlashOutputPer1k;
        unit = 'tokens';
        break;
      case 'video_render':
        cost = amount * pricing.veoPerSecond;
        unit = 'seconds';
        break;
      case 'storage':
        cost = amount * pricing.storagePerGBMonth;
        unit = 'GB';
        break;
      default:
        logger.warn(`Bilinmeyen maliyet tipi: ${type}`);
        return null;
    }

    // Sipariş maliyetlerini güncelle
    if (!this.orderCosts.has(orderId)) {
      this.orderCosts.set(orderId, { items: [], total: 0 });
    }

    const orderCost = this.orderCosts.get(orderId);
    const costItem = {
      type,
      amount,
      unit,
      cost,
      timestamp: new Date().toISOString()
    };

    orderCost.items.push(costItem);
    orderCost.total += cost;

    // Global sayaçları güncelle
    this.dailyTotal += cost;
    this.monthlyTotal += cost;

    logger.debug('Maliyet eklendi', {
      orderId,
      type,
      amount,
      cost: cost.toFixed(6),
      orderTotal: orderCost.total.toFixed(4)
    });

    return costItem;
  }

  /**
   * Sipariş maliyetini kontrol et
   * @param {string} orderId - Sipariş ID
   * @returns {object} - Maliyet durumu
   */
  checkOrderBudget(orderId) {
    const orderCost = this.orderCosts.get(orderId);
    const total = orderCost?.total || 0;
    const limit = config.costs.maxPerOrder;

    return {
      current: total,
      limit,
      remaining: limit - total,
      isOverBudget: total > limit,
      percentage: (total / limit) * 100
    };
  }

  /**
   * Günlük bütçeyi kontrol et
   * @returns {object} - Günlük bütçe durumu
   */
  checkDailyBudget() {
    this._checkResets();
    const limit = config.costs.dailyLimit;

    return {
      current: this.dailyTotal,
      limit,
      remaining: limit - this.dailyTotal,
      isOverBudget: this.dailyTotal > limit,
      percentage: (this.dailyTotal / limit) * 100
    };
  }

  /**
   * Aylık bütçeyi kontrol et
   * @returns {object} - Aylık bütçe durumu
   */
  checkMonthlyBudget() {
    this._checkResets();
    const limit = config.costs.monthlyLimit;

    return {
      current: this.monthlyTotal,
      limit,
      remaining: limit - this.monthlyTotal,
      isOverBudget: this.monthlyTotal > limit,
      percentage: (this.monthlyTotal / limit) * 100
    };
  }

  /**
   * Yeni işlem başlatılabilir mi kontrol et
   * @param {string} orderId - Sipariş ID
   * @param {number} estimatedCost - Tahmini maliyet
   * @returns {object} - Onay durumu
   */
  canProceed(orderId, estimatedCost = 0) {
    const orderBudget = this.checkOrderBudget(orderId);
    const dailyBudget = this.checkDailyBudget();
    const monthlyBudget = this.checkMonthlyBudget();

    const canProceed =
      orderBudget.remaining >= estimatedCost &&
      dailyBudget.remaining >= estimatedCost &&
      monthlyBudget.remaining >= estimatedCost;

    if (!canProceed) {
      const reasons = [];
      if (orderBudget.remaining < estimatedCost) reasons.push('sipariş bütçesi');
      if (dailyBudget.remaining < estimatedCost) reasons.push('günlük bütçe');
      if (monthlyBudget.remaining < estimatedCost) reasons.push('aylık bütçe');

      logger.warn('Bütçe limiti aşılıyor', {
        orderId,
        estimatedCost,
        reasons
      });
    }

    return {
      canProceed,
      orderBudget,
      dailyBudget,
      monthlyBudget
    };
  }

  /**
   * Sipariş maliyet raporunu al
   * @param {string} orderId - Sipariş ID
   * @returns {object} - Detaylı maliyet raporu
   */
  getOrderReport(orderId) {
    const orderCost = this.orderCosts.get(orderId);

    if (!orderCost) {
      return {
        orderId,
        items: [],
        total: 0,
        breakdown: {}
      };
    }

    // Tip bazlı breakdown
    const breakdown = {};
    for (const item of orderCost.items) {
      if (!breakdown[item.type]) {
        breakdown[item.type] = { count: 0, totalAmount: 0, totalCost: 0 };
      }
      breakdown[item.type].count++;
      breakdown[item.type].totalAmount += item.amount;
      breakdown[item.type].totalCost += item.cost;
    }

    return {
      orderId,
      items: orderCost.items,
      total: orderCost.total,
      breakdown,
      budget: this.checkOrderBudget(orderId)
    };
  }

  /**
   * Global istatistikleri al
   * @returns {object} - Sistem geneli maliyet istatistikleri
   */
  getGlobalStats() {
    this._checkResets();

    const allOrders = Array.from(this.orderCosts.entries());
    const completedOrders = allOrders.filter(([_, cost]) => cost.total > 0);

    return {
      dailyTotal: this.dailyTotal,
      monthlyTotal: this.monthlyTotal,
      dailyBudget: this.checkDailyBudget(),
      monthlyBudget: this.checkMonthlyBudget(),
      activeOrders: this.orderCosts.size,
      averageCostPerOrder:
        completedOrders.length > 0
          ? completedOrders.reduce((sum, [_, cost]) => sum + cost.total, 0) /
            completedOrders.length
          : 0
    };
  }

  /**
   * Siparişi temizle (tamamlandığında)
   * @param {string} orderId - Sipariş ID
   */
  clearOrder(orderId) {
    const report = this.getOrderReport(orderId);
    logger.info('Sipariş maliyet özeti', {
      orderId,
      totalCost: report.total.toFixed(4),
      breakdown: report.breakdown
    });
    // Veriyi sakla, silme - geçmiş için lazım olabilir
  }
}

// Singleton instance
export const costTracker = new CostTracker();

export default costTracker;
