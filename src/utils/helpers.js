/**
 * Rejista - Yardımcı Fonksiyonlar
 * Güvenli JSON parsing, validation ve utility fonksiyonları
 */

import { logger } from './logger.js';

/**
 * Güvenli JSON.parse wrapper
 * @param {string} jsonString - Parse edilecek string
 * @param {*} defaultValue - Parse başarısız olursa dönecek değer
 * @param {string} context - Log için context bilgisi
 * @returns {*} - Parse edilmiş değer veya default
 */
export function safeJsonParse(jsonString, defaultValue = null, context = 'unknown') {
  if (!jsonString || typeof jsonString !== 'string') {
    return defaultValue;
  }

  try {
    // İlk olarak JSON string'i temizle (BOM ve whitespace)
    const cleaned = jsonString.trim().replace(/^\uFEFF/, '');

    if (!cleaned) {
      return defaultValue;
    }

    return JSON.parse(cleaned);
  } catch (error) {
    logger.warn('JSON parse failed', {
      context,
      error: error.message,
      preview: jsonString.slice(0, 100)
    });
    return defaultValue;
  }
}

/**
 * JSON string içinden JSON objesini çıkar (Gemini yanıtları için)
 * @param {string} text - Metin içinde JSON olabilecek string
 * @param {*} defaultValue - Bulunamazsa dönecek değer
 * @param {string} context - Log için context
 * @returns {*} - Parse edilmiş JSON veya default
 */
export function extractJsonFromText(text, defaultValue = null, context = 'unknown') {
  if (!text || typeof text !== 'string') {
    return defaultValue;
  }

  try {
    // Önce direkt parse dene
    return JSON.parse(text.trim());
  } catch {
    // JSON bloğu ara
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/,  // ```json ... ```
      /```\s*([\s\S]*?)\s*```/,       // ``` ... ```
      /(\{[\s\S]*\})/,                // { ... }
      /(\[[\s\S]*\])/                 // [ ... ]
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const jsonStr = match[1].trim();
          return JSON.parse(jsonStr);
        } catch {
          continue;
        }
      }
    }

    logger.warn('Could not extract JSON from text', {
      context,
      textLength: text.length,
      preview: text.slice(0, 200)
    });
    return defaultValue;
  }
}

/**
 * Nesnenin geçerli olup olmadığını kontrol et
 * @param {*} obj - Kontrol edilecek nesne
 * @param {Array<string>} requiredKeys - Zorunlu anahtarlar
 * @returns {boolean}
 */
export function validateObject(obj, requiredKeys = []) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  return requiredKeys.every(key => {
    const keys = key.split('.');
    let value = obj;
    for (const k of keys) {
      if (value == null || typeof value !== 'object') {
        return false;
      }
      value = value[k];
    }
    return value !== undefined && value !== null;
  });
}

/**
 * Güvenli nesne erişimi
 * @param {object} obj - Kaynak nesne
 * @param {string} path - Nokta ile ayrılmış yol (örn: 'a.b.c')
 * @param {*} defaultValue - Varsayılan değer
 * @returns {*}
 */
export function getNestedValue(obj, path, defaultValue = undefined) {
  if (!obj || typeof path !== 'string') {
    return defaultValue;
  }

  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value == null || typeof value !== 'object') {
      return defaultValue;
    }
    value = value[key];
  }

  return value !== undefined ? value : defaultValue;
}

/**
 * String'i güvenli şekilde sanitize et
 * @param {string} str - Sanitize edilecek string
 * @param {object} options - Seçenekler
 * @returns {string}
 */
export function sanitizeString(str, options = {}) {
  const {
    maxLength = 1000,
    allowHtml = false,
    allowNewlines = true
  } = options;

  if (typeof str !== 'string') {
    return '';
  }

  let result = str;

  // HTML karakterlerini temizle
  if (!allowHtml) {
    result = result
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Newline'ları temizle
  if (!allowNewlines) {
    result = result.replace(/[\r\n]/g, ' ');
  }

  // Kontrol karakterlerini temizle
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Uzunluk sınırla
  return result.trim().slice(0, maxLength);
}

/**
 * Email formatını doğrula
 * @param {string} email - Email adresi
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Türk telefon numarası formatını doğrula
 * @param {string} phone - Telefon numarası
 * @returns {boolean}
 */
export function isValidTurkishPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // +90 5XX XXX XX XX veya 05XX XXX XX XX
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^(\+90|0)?5\d{9}$/.test(cleaned);
}

/**
 * Tarih string'ini güvenli parse et
 * @param {string|Date} date - Tarih
 * @param {Date} defaultValue - Varsayılan değer
 * @returns {Date}
 */
export function safeParseDate(date, defaultValue = new Date()) {
  if (date instanceof Date && !isNaN(date)) {
    return date;
  }

  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

/**
 * Sayıyı güvenli parse et
 * @param {*} value - Değer
 * @param {number} defaultValue - Varsayılan
 * @returns {number}
 */
export function safeParseNumber(value, defaultValue = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Async işlemi timeout ile çalıştır
 * @param {Promise} promise - Promise
 * @param {number} ms - Timeout süresi
 * @param {string} operationName - İşlem adı
 * @returns {Promise}
 */
export function withTimeout(promise, ms, operationName = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timeout after ${ms}ms`)),
        ms
      )
    )
  ]);
}

/**
 * Debounce fonksiyonu
 * @param {Function} fn - Fonksiyon
 * @param {number} delay - Gecikme (ms)
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * UUID v4 üret
 * @returns {string}
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default {
  safeJsonParse,
  extractJsonFromText,
  validateObject,
  getNestedValue,
  sanitizeString,
  isValidEmail,
  isValidTurkishPhone,
  safeParseDate,
  safeParseNumber,
  withTimeout,
  debounce,
  generateUUID
};
