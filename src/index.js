/**
 * ============================================
 * REJISTA - Otonom Video Üretim Ekosistemi
 * ============================================
 *
 * Etsy siparişlerini otomatik olarak profesyonel
 * ticari videolara dönüştüren AI-powered sistem
 *
 * @author Rejista Team
 * @version 1.0.0
 */

import { config, validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { sheetsService } from './services/googleSheets.js';
import { driveService } from './services/googleDrive.js';
import { gmailService } from './services/gmail.js';
import { geminiService } from './services/gemini.js';
import { vertexAIService } from './services/vertexAI.js';
import { initializeAgents, startAllAgents, stopAllAgents } from './agents/index.js';
import { startDashboardServer } from './dashboard/server.js';

// Global ajan referansı
let agents = null;

/**
 * Tüm servisleri başlat
 */
async function initializeServices() {
  logger.info('========================================');
  logger.info('🎬 REJISTA - Video Üretim Ekosistemi');
  logger.info('========================================');
  logger.info('Servisler başlatılıyor...');

  try {
    // 1. Google Sheets
    logger.info('📊 Google Sheets bağlanıyor...');
    await sheetsService.initialize();

    // 2. Google Drive
    logger.info('📁 Google Drive bağlanıyor...');
    await driveService.initialize();

    // 3. Gmail
    logger.info('📧 Gmail servisi başlatılıyor...');
    await gmailService.initialize();

    // 4. Gemini AI
    logger.info('🧠 Gemini AI başlatılıyor...');
    await geminiService.initialize();

    // 5. Vertex AI
    logger.info('🎥 Vertex AI başlatılıyor...');
    await vertexAIService.initialize();

    logger.info('✅ Tüm servisler başarıyla başlatıldı');
    return true;
  } catch (error) {
    logger.error('Servis başlatma hatası', { error: error.message });
    throw error;
  }
}

/**
 * Ana başlatma fonksiyonu
 */
async function main() {
  try {
    // 1. Konfigürasyonu doğrula
    logger.info('Konfigürasyon kontrol ediliyor...');

    if (!validateConfig()) {
      logger.warn('Eksik konfigürasyon değerleri var, demo modda çalışılacak');
    }

    // 2. Servisleri başlat
    await initializeServices();

    // 3. Ajanları başlat
    logger.info('🤖 AI Ajanları başlatılıyor...');
    agents = await initializeAgents();
    await startAllAgents(agents);
    logger.info('✅ Tüm ajanlar aktif');

    // 4. Dashboard sunucusunu başlat
    logger.info('📊 Dashboard başlatılıyor...');
    await startDashboardServer(agents);

    // 5. Sistem hazır
    logger.info('========================================');
    logger.info('🚀 REJISTA SİSTEMİ AKTİF');
    logger.info(`📊 Dashboard: http://localhost:${config.dashboard.port}`);
    logger.info(`🔧 API: http://localhost:${config.server.port}`);
    logger.info('========================================');

    // Graceful shutdown
    setupGracefulShutdown();
  } catch (error) {
    logger.error('Sistem başlatma hatası', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown ayarları
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`${signal} sinyali alındı, sistem kapatılıyor...`);

    try {
      if (agents) {
        await stopAllAgents(agents);
        logger.info('Ajanlar durduruldu');
      }

      logger.info('Sistem güvenli şekilde kapatıldı');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown hatası', { error: error.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error('Yakalanmamış hata', { error: error.message, stack: error.stack });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Yakalanmamış Promise rejection', { reason });
  });
}

// CLI argümanlarını işle
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
REJISTA - Otonom Video Üretim Ekosistemi

Kullanım:
  npm start              Sistemi başlat
  npm run dashboard      Sadece dashboard'u başlat

Ortam Değişkenleri:
  GOOGLE_CLOUD_PROJECT_ID    GCP proje ID
  GEMINI_API_KEY             Gemini API anahtarı
  GOOGLE_SHEETS_ID           Sheets ID
  GOOGLE_DRIVE_FOLDER_ID     Drive klasör ID

Daha fazla bilgi için README.md dosyasına bakın.
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('Rejista v1.0.0');
  process.exit(0);
}

// Ana fonksiyonu çalıştır
main();

export { main, agents };
