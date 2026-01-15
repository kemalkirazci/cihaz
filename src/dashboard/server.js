/**
 * Rejista - Dashboard Sunucusu
 * Yönetim konsolu API ve statik dosya sunucusu
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { sheetsService } from '../services/googleSheets.js';
import { costTracker } from '../utils/costTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let agentsRef = null;

/**
 * Dashboard sunucusunu başlat
 * @param {object} agents - Ajan referansları
 */
export async function startDashboardServer(agents) {
  agentsRef = agents;

  const app = express();

  // Middleware
  app.use(cors());
  app.use(helmet({
    contentSecurityPolicy: false // Dashboard için CSP'yi gevşet
  }));
  app.use(express.json());

  // Statik dosyalar
  app.use(express.static(join(__dirname, 'public')));

  // API Routes
  setupAPIRoutes(app);

  // Ana sayfa
  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
  });

  // Sunucuyu başlat
  const port = config.dashboard.port;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info(`Dashboard sunucusu başlatıldı: http://localhost:${port}`);
      resolve(server);
    });

    server.on('error', reject);
  });
}

/**
 * API route'larını ayarla
 */
function setupAPIRoutes(app) {
  // Sistem durumu
  app.get('/api/status', async (req, res) => {
    try {
      const status = {
        system: {
          status: 'running',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        agents: getAgentStatuses(),
        budget: costTracker.getGlobalStats()
      };

      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sipariş listesi
  app.get('/api/orders', async (req, res) => {
    try {
      const stats = await sheetsService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sipariş detayı
  app.get('/api/orders/:orderId', async (req, res) => {
    try {
      const order = await sheetsService.getOrder(req.params.orderId);

      if (!order) {
        return res.status(404).json({ error: 'Sipariş bulunamadı' });
      }

      const costReport = costTracker.getOrderReport(req.params.orderId);

      res.json({
        ...order,
        costReport
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ajan durumları
  app.get('/api/agents', (req, res) => {
    try {
      res.json(getAgentStatuses());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bütçe durumu
  app.get('/api/budget', (req, res) => {
    try {
      const stats = costTracker.getGlobalStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manuel sipariş ekleme
  app.post('/api/orders', async (req, res) => {
    try {
      const { customerName, customerEmail, productName, etsyOrderId } = req.body;

      if (!customerName || !productName) {
        return res.status(400).json({ error: 'customerName ve productName gerekli' });
      }

      const orderId = await sheetsService.addOrder({
        customerName,
        customerEmail,
        productName,
        etsyOrderId: etsyOrderId || `MANUAL-${Date.now()}`
      });

      res.json({ orderId, message: 'Sipariş oluşturuldu' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sipariş durumu güncelleme
  app.patch('/api/orders/:orderId/status', async (req, res) => {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'status gerekli' });
      }

      await sheetsService.updateOrderStatus(req.params.orderId, status);

      res.json({ message: 'Durum güncellendi' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ajan kontrolü
  app.post('/api/agents/:agentName/action', (req, res) => {
    try {
      const { action } = req.body;
      const agentName = req.params.agentName;

      const agent = findAgent(agentName);

      if (!agent) {
        return res.status(404).json({ error: 'Ajan bulunamadı' });
      }

      switch (action) {
        case 'pause':
          agent.pause();
          break;
        case 'resume':
          agent.resume();
          break;
        case 'stop':
          agent.stop();
          break;
        default:
          return res.status(400).json({ error: 'Geçersiz aksiyon' });
      }

      res.json({ message: `${agentName} ${action} yapıldı` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sistem metrikleri (SSE)
  app.get('/api/metrics/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendMetrics = () => {
      const data = {
        timestamp: new Date().toISOString(),
        agents: getAgentStatuses(),
        budget: costTracker.getGlobalStats(),
        memory: process.memoryUsage()
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // İlk veri
    sendMetrics();

    // Her 5 saniyede güncelle
    const interval = setInterval(sendMetrics, 5000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });
}

/**
 * Ajan durumlarını al
 */
function getAgentStatuses() {
  if (!agentsRef) {
    return [];
  }

  const { moderator, contentAnalyzer, productionAgents } = agentsRef;

  return [
    moderator?.getStatus(),
    contentAnalyzer?.getStatus(),
    ...(productionAgents?.map((a) => a.getStatus()) || [])
  ].filter(Boolean);
}

/**
 * Ajan bul
 */
function findAgent(name) {
  if (!agentsRef) return null;

  const { moderator, contentAnalyzer, productionAgents } = agentsRef;

  if (moderator?.name === name) return moderator;
  if (contentAnalyzer?.name === name) return contentAnalyzer;

  return productionAgents?.find((a) => a.name === name);
}

export default { startDashboardServer };
