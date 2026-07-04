/**
 * Rejista - Retry ve Hata Kurtarma Mekanizması
 * Exponential backoff ile güvenilir operasyonlar
 */

import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Exponential backoff ile retry
 * @param {Function} fn - Çalıştırılacak async fonksiyon
 * @param {object} options - Retry seçenekleri
 * @returns {Promise<any>} - Fonksiyon sonucu
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = config.retry.maxAttempts,
    delayMs = config.retry.delayMs,
    backoffMultiplier = config.retry.backoffMultiplier,
    operationName = 'operation',
    shouldRetry = (error) => true, // Hangi hatalarda retry yapılacak
    onRetry = null // Her retry öncesi callback
  } = options;

  let lastError;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Rate limit veya geçici hata mı kontrol et
      const isRateLimit = error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED';
      const isTransient = error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.status >= 500;

      // Retry yapılmalı mı?
      if (attempt < maxAttempts && (isRateLimit || isTransient || shouldRetry(error))) {
        // Rate limit için extra bekleme
        const waitTime = isRateLimit ? currentDelay * 2 : currentDelay;

        logger.warn(`${operationName} başarısız, retry yapılacak`, {
          attempt,
          maxAttempts,
          waitTime,
          error: error.message,
          isRateLimit
        });

        if (onRetry) {
          await onRetry(error, attempt);
        }

        await sleep(waitTime);
        currentDelay *= backoffMultiplier;
      } else {
        // Retry yapılmayacak veya son deneme
        break;
      }
    }
  }

  logger.error(`${operationName} tüm denemelerde başarısız`, {
    maxAttempts,
    error: lastError.message
  });

  throw lastError;
}

/**
 * Promise timeout wrapper
 * @param {Promise} promise - Timeout uygulanacak promise
 * @param {number} ms - Timeout süresi (ms)
 * @param {string} operationName - İşlem adı
 * @returns {Promise<any>}
 */
export function withTimeout(promise, ms, operationName = 'operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timeout after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Sleep utility
 * @param {number} ms - Bekleme süresi (ms)
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit breaker pattern
 * Belirli sayıda hata sonrası servisi geçici olarak devre dışı bırak
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 dakika
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.name = options.name || 'circuit';
  }

  async execute(fn) {
    // Circuit açıksa direkt hata fırlat
    if (this.state === 'OPEN') {
      // Reset timeout geçti mi kontrol et
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit ${this.name} HALF_OPEN durumuna geçti`);
      } else {
        throw new Error(`Circuit ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();

      // Başarılı - circuit'i resetle
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info(`Circuit ${this.name} CLOSED durumuna döndü`);
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.error(`Circuit ${this.name} OPEN durumuna geçti`, {
          failures: this.failures
        });
      }

      throw error;
    }
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = null;
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Rate limiter - Token bucket algoritması
 */
export class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 10;
    this.refillRate = options.refillRate || 1; // Token/saniye
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(tokens = 1) {
    this._refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    // Token yoksa bekle
    const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
    await sleep(waitTime);
    this._refill();
    this.tokens -= tokens;
    return true;
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  getStatus() {
    this._refill();
    return {
      availableTokens: this.tokens,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate
    };
  }
}

export default { withRetry, withTimeout, sleep, CircuitBreaker, RateLimiter };
