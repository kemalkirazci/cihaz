/**
 * Rejista - Merkezi Konfigürasyon Modülü
 * Tüm sistem ayarları burada yönetilir
 *
 * GÜVENLİK İYİLEŞTİRMELERİ:
 * - Strict validation with type checking
 * - Throws errors for critical missing values
 * - Environment-aware validation
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Custom error for configuration issues
 */
class ConfigurationError extends Error {
  constructor(message, missingFields = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.missingFields = missingFields;
  }
}

export const config = {
  // Google Cloud Platform
  gcp: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    region: process.env.GOOGLE_CLOUD_REGION || 'us-central1'
  },

  // Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    flashModel: 'gemini-1.5-flash', // Düşük maliyetli işlemler için
    maxTokens: 8192,
    temperature: 0.7,
    analysisTimeoutMs: parseInt(process.env.GEMINI_ANALYSIS_TIMEOUT_MS) || 60000,
    conceptTimeoutMs: parseInt(process.env.GEMINI_CONCEPT_TIMEOUT_MS) || 30000,
    connectionTestTimeoutMs: parseInt(process.env.GEMINI_CONNECTION_TEST_TIMEOUT_MS) || 10000
  },

  // Vertex AI & Video Üretim
  vertexAI: {
    location: process.env.VERTEX_AI_LOCATION || 'us-central1',
    veoEndpoint: process.env.VEO_MODEL_ENDPOINT,
    imagenModel: 'imagegeneration@006' // Fallback için Imagen 3
  },

  // Google Workspace
  workspace: {
    sheetsId: process.env.GOOGLE_SHEETS_ID,
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    gmailUser: process.env.GMAIL_USER_EMAIL
  },

  // Etsy Entegrasyonu
  etsy: {
    apiKey: process.env.ETSY_API_KEY,
    shopId: process.env.ETSY_SHOP_ID,
    pollingInterval: 60000 // 1 dakika
  },

  // Sunucu Ayarları
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Maliyet Limitleri (USD)
  costs: {
    maxPerOrder: parseFloat(process.env.MAX_COST_PER_ORDER) || 5.00,
    dailyLimit: parseFloat(process.env.DAILY_BUDGET_LIMIT) || 100.00,
    monthlyLimit: parseFloat(process.env.MONTHLY_BUDGET_LIMIT) || 2000.00,
    // Birim maliyetler (tahmini)
    pricing: {
      geminiProInputPer1k: 0.00125, // $1.25 per 1M tokens
      geminiProOutputPer1k: 0.005,  // $5 per 1M tokens
      geminiFlashInputPer1k: 0.000075,
      geminiFlashOutputPer1k: 0.0003,
      veoPerSecond: 0.02, // Tahmini
      storagePerGBMonth: 0.02
    }
  },

  // Video Üretim Ayarları
  video: {
    durationSeconds: parseInt(process.env.VIDEO_DURATION_SECONDS) || 60,
    resolution: process.env.VIDEO_RESOLUTION || '1080p',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_PRODUCTIONS) || 3,
    timeoutMs: parseInt(process.env.PRODUCTION_TIMEOUT_MS) || 300000,
    formats: ['mp4'],
    aspectRatios: ['16:9', '9:16', '1:1'] // Landscape, Portrait, Square
  },

  // Retry Mekanizması
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
    delayMs: parseInt(process.env.RETRY_DELAY_MS) || 2000,
    backoffMultiplier: 2
  },

  // Dashboard
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT) || 8080,
    secret: process.env.DASHBOARD_SECRET,
    sseTimeoutMs: parseInt(process.env.SSE_TIMEOUT_MS) || 300000,
    sseUpdateIntervalMs: parseInt(process.env.SSE_UPDATE_INTERVAL_MS) || 5000,
    refreshIntervalMs: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL_MS) || 30000,
    maxSseConnections: parseInt(process.env.MAX_SSE_CONNECTIONS) || 50
  },

  // Ajan Ayarları
  agents: {
    moderatorPollInterval: parseInt(process.env.MODERATOR_POLL_INTERVAL_MS) || 10000,
    analyzerPollInterval: parseInt(process.env.ANALYZER_POLL_INTERVAL_MS) || 5000,
    productionPollInterval: parseInt(process.env.PRODUCTION_POLL_INTERVAL_MS) || 5000,
    defaultPollInterval: parseInt(process.env.DEFAULT_POLL_INTERVAL_MS) || 5000,
    errorRecoveryDelayMs: parseInt(process.env.ERROR_RECOVERY_DELAY_MS) || 30000,
    restartDelayMs: parseInt(process.env.AGENT_RESTART_DELAY_MS) || 5000,
    stopTimeoutMs: parseInt(process.env.AGENT_STOP_TIMEOUT_MS) || 10000,
    loopCleanupTimeoutMs: parseInt(process.env.LOOP_CLEANUP_TIMEOUT_MS) || 5000
  },

  // Sipariş Durumları
  orderStatuses: {
    PENDING: 'Analiz Bekliyor',
    ANALYZING: 'Analiz Ediliyor',
    CONCEPT_READY: 'Konsept Hazır',
    PRODUCING: 'Video Üretiliyor',
    QUALITY_CHECK: 'Kalite Kontrol',
    DELIVERING: 'Teslim Ediliyor',
    COMPLETED: 'Tamamlandı',
    FAILED: 'Başarısız',
    CANCELLED: 'İptal Edildi'
  },

  // Video Konsept Tipleri
  conceptTypes: {
    ENERGETIC: {
      name: 'Enerjik',
      description: 'Dinamik geçişler, canlı renkler, hızlı tempo',
      musicMood: 'upbeat',
      transitionStyle: 'fast'
    },
    MINIMAL: {
      name: 'Minimal',
      description: 'Temiz çizgiler, beyaz alan, zarif geçişler',
      musicMood: 'calm',
      transitionStyle: 'smooth'
    },
    CINEMATIC: {
      name: 'Sinematik',
      description: 'Dramatik aydınlatma, yavaş çekim, film estetiği',
      musicMood: 'dramatic',
      transitionStyle: 'cinematic'
    }
  }
};

/**
 * Safe integer parsing with validation
 */
function safeParseInt(value, defaultValue, min = 0, max = Infinity) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Safe float parsing with validation
 */
function safeParseFloat(value, defaultValue, min = 0, max = Infinity) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Get config value by path (e.g., 'gcp.projectId')
 */
function getConfigValue(path) {
  const keys = path.split('.');
  let value = config;
  for (const key of keys) {
    value = value?.[key];
  }
  return value;
}

/**
 * Konfigürasyon doğrulama
 * @param {object} options - Validation options
 * @param {boolean} options.throwOnError - Throw exception on validation failure (default: production mode)
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateConfig(options = {}) {
  const isProduction = config.server.nodeEnv === 'production';
  const throwOnError = options.throwOnError ?? isProduction;

  const errors = [];
  const warnings = [];

  // Kritik alanlar - olmadan sistem çalışamaz
  const criticalFields = [
    { path: 'gcp.projectId', description: 'Google Cloud Project ID' },
    { path: 'gemini.apiKey', description: 'Gemini API Key' },
    { path: 'workspace.sheetsId', description: 'Google Sheets ID' },
    { path: 'workspace.driveFolderId', description: 'Google Drive Folder ID' }
  ];

  // Önerilen alanlar - olmadan bazı özellikler çalışmaz
  const recommendedFields = [
    { path: 'workspace.gmailUser', description: 'Gmail User Email' },
    { path: 'dashboard.secret', description: 'Dashboard API Secret (authentication disabled without this)' },
    { path: 'vertexAI.veoEndpoint', description: 'Veo Model Endpoint (video generation disabled without this)' }
  ];

  // Kritik alan kontrolü
  for (const field of criticalFields) {
    const value = getConfigValue(field.path);
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`Missing critical config: ${field.path} (${field.description})`);
    }
  }

  // Önerilen alan kontrolü
  for (const field of recommendedFields) {
    const value = getConfigValue(field.path);
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      warnings.push(`Missing recommended config: ${field.path} (${field.description})`);
    }
  }

  // Tip ve değer validasyonları
  const numericValidations = [
    { path: 'server.port', min: 1, max: 65535, description: 'Server port' },
    { path: 'dashboard.port', min: 1, max: 65535, description: 'Dashboard port' },
    { path: 'costs.maxPerOrder', min: 0.01, max: 1000, description: 'Max cost per order' },
    { path: 'costs.dailyLimit', min: 1, max: 100000, description: 'Daily budget limit' },
    { path: 'video.durationSeconds', min: 5, max: 600, description: 'Video duration' },
    { path: 'video.maxConcurrent', min: 1, max: 10, description: 'Max concurrent productions' },
    { path: 'retry.maxAttempts', min: 1, max: 10, description: 'Max retry attempts' }
  ];

  for (const validation of numericValidations) {
    const value = getConfigValue(validation.path);
    if (typeof value === 'number') {
      if (value < validation.min || value > validation.max) {
        warnings.push(
          `Config ${validation.path} (${value}) is outside recommended range [${validation.min}-${validation.max}]`
        );
      }
    }
  }

  // Production-specific validasyonlar
  if (isProduction) {
    // Dashboard secret production'da zorunlu
    if (!config.dashboard.secret) {
      errors.push('DASHBOARD_SECRET is required in production mode');
    }

    // API key format validation (basic check)
    if (config.gemini.apiKey && config.gemini.apiKey.length < 20) {
      warnings.push('Gemini API key appears to be invalid (too short)');
    }
  }

  // Sonuçları logla
  if (errors.length > 0) {
    console.error('❌ Konfigürasyon hataları:');
    errors.forEach(e => console.error(`   - ${e}`));
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Konfigürasyon uyarıları:');
    warnings.forEach(w => console.warn(`   - ${w}`));
  }

  const valid = errors.length === 0;

  if (!valid && throwOnError) {
    throw new ConfigurationError(
      `Configuration validation failed: ${errors.join('; ')}`,
      errors
    );
  }

  if (valid && errors.length === 0 && warnings.length === 0) {
    console.log('✅ Konfigürasyon doğrulaması başarılı');
  }

  return { valid, errors, warnings };
}

// Apply safe parsing to numeric config values
config.server.port = safeParseInt(process.env.PORT, 3000, 1, 65535);
config.dashboard.port = safeParseInt(process.env.DASHBOARD_PORT, 8080, 1, 65535);
config.costs.maxPerOrder = safeParseFloat(process.env.MAX_COST_PER_ORDER, 5.00, 0.01, 1000);
config.costs.dailyLimit = safeParseFloat(process.env.DAILY_BUDGET_LIMIT, 100.00, 1, 100000);
config.costs.monthlyLimit = safeParseFloat(process.env.MONTHLY_BUDGET_LIMIT, 2000.00, 1, 1000000);
config.video.durationSeconds = safeParseInt(process.env.VIDEO_DURATION_SECONDS, 60, 5, 600);
config.video.maxConcurrent = safeParseInt(process.env.MAX_CONCURRENT_PRODUCTIONS, 3, 1, 10);
config.video.timeoutMs = safeParseInt(process.env.PRODUCTION_TIMEOUT_MS, 300000, 30000, 1800000);
config.retry.maxAttempts = safeParseInt(process.env.MAX_RETRY_ATTEMPTS, 3, 1, 10);
config.retry.delayMs = safeParseInt(process.env.RETRY_DELAY_MS, 2000, 100, 60000);

export { ConfigurationError };
export default config;
