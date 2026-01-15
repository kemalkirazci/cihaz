/**
 * Rejista - Merkezi Konfigürasyon Modülü
 * Tüm sistem ayarları burada yönetilir
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

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
    temperature: 0.7
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
    secret: process.env.DASHBOARD_SECRET
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

// Konfigürasyon doğrulama
export function validateConfig() {
  const required = [
    'gcp.projectId',
    'gemini.apiKey',
    'workspace.sheetsId',
    'workspace.driveFolderId'
  ];

  const missing = [];

  for (const path of required) {
    const keys = path.split('.');
    let value = config;
    for (const key of keys) {
      value = value?.[key];
    }
    if (!value) {
      missing.push(path);
    }
  }

  if (missing.length > 0) {
    console.warn(`⚠️ Eksik konfigürasyon değerleri: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

export default config;
