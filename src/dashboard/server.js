/**
 * Rejista - Dashboard Sunucusu
 * Yönetim konsolu API ve statik dosya sunucusu
 *
 * GÜVENLİK İYİLEŞTİRMELERİ:
 * - API Key authentication
 * - Rate limiting
 * - Input validation & sanitization
 * - CSP headers
 * - Memory leak fixes
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { sheetsService } from '../services/googleSheets.js';
import { costTracker } from '../utils/costTracker.js';
import { RateLimiter } from '../utils/retry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let agentsRef = null;

// Rate limiter instances
const apiRateLimiter = new RateLimiter({ maxTokens: 60, refillRate: 1 }); // 60 req/min
const orderRateLimiter = new RateLimiter({ maxTokens: 10, refillRate: 0.5 }); // 10 req/20s

// Active SSE connections tracking (memory leak fix)
const activeConnections = new Set();
// These values are from config but accessed here for performance
const MAX_SSE_CONNECTIONS = config.dashboard.maxSseConnections;
const SSE_TIMEOUT_MS = config.dashboard.sseTimeoutMs;

/**
 * Input sanitization - XSS ve injection önleme
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // HTML tags
    .replace(/['"]/g, '') // Quotes
    .replace(/[\x00-\x1f]/g, '') // Control characters
    .trim()
    .slice(0, 500); // Max length
}

/**
 * Email validation
 */
function isValidEmail(email) {
  if (!email) return true; // Optional field
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Order ID validation
 */
function isValidOrderId(orderId) {
  if (!orderId) return false;
  // Format: ORD-XXXXXXXXX or MANUAL-XXXXXXXXX
  return /^(ORD|MANUAL)-\d{1,20}$/.test(orderId);
}

/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
  // Public endpoints (no auth required)
  const publicPaths = ['/', '/index.html', '/api/status'];
  if (publicPaths.includes(req.path) || req.path.startsWith('/api/metrics/stream')) {
    return next();
  }

  // Check API key
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const dashboardSecret = config.dashboard.secret;

  // Development mode bypass (only if explicitly set)
  if (config.server.nodeEnv === 'development' && !dashboardSecret) {
    logger.warn('Dashboard authentication bypassed in development mode');
    return next();
  }

  if (!dashboardSecret) {
    logger.error('DASHBOARD_SECRET not configured');
    return res.status(500).json({
      error: 'Server configuration error',
      code: 'CONFIG_ERROR'
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Timing-safe comparison
  const keyBuffer = Buffer.from(apiKey);
  const secretBuffer = Buffer.from(dashboardSecret);

  if (keyBuffer.length !== secretBuffer.length ||
      !crypto.timingSafeEqual(keyBuffer, secretBuffer)) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({
      error: 'Invalid API key',
      code: 'AUTH_FAILED'
    });
  }

  next();
}

/**
 * Rate limiting middleware
 */
function rateLimitMiddleware(limiter) {
  return async (req, res, next) => {
    const canProceed = await limiter.acquire(1);
    if (!canProceed) {
      logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 60
      });
    }
    next();
  };
}

/**
 * Error response helper - hides internal details
 */
function sendError(res, statusCode, message, code = 'ERROR') {
  logger.error(`API Error: ${message}`, { statusCode, code });
  res.status(statusCode).json({
    error: message,
    code,
    timestamp: new Date().toISOString()
  });
}

/**
 * Dashboard sunucusunu başlat
 * @param {object} agents - Ajan referansları
 */
export async function startDashboardServer(agents) {
  agentsRef = agents;

  const app = express();

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS - restricted origins in production
  app.use(cors({
    origin: config.server.nodeEnv === 'production'
      ? ['https://yourdomain.com']
      : true,
    credentials: true
  }));

  app.use(express.json({ limit: '10kb' })); // Body size limit

  // Authentication
  app.use(authMiddleware);

  // General rate limiting
  app.use('/api/', rateLimitMiddleware(apiRateLimiter));

  // Statik dosyalar
  app.use(express.static(join(__dirname, 'public')));

  // API Routes
  setupAPIRoutes(app);

  // Ana sayfa
  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    sendError(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  });

  // Sunucuyu başlat
  const port = config.dashboard.port;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info(`Dashboard sunucusu başlatıldı`, { port });
      resolve(server);
    });

    server.on('error', reject);

    // Graceful shutdown için server referansı
    process.on('SIGTERM', () => {
      logger.info('Shutting down dashboard server...');
      activeConnections.forEach(conn => conn.end());
      server.close();
    });
  });
}

/**
 * API route'larını ayarla
 */
function setupAPIRoutes(app) {
  // Sistem durumu (public)
  app.get('/api/status', async (req, res) => {
    try {
      const status = {
        system: {
          status: 'running',
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString()
        },
        agents: getAgentStatuses(),
        budget: {
          dailyUsagePercent: costTracker.getGlobalStats().dailyBudget?.percentage || 0,
          monthlyUsagePercent: costTracker.getGlobalStats().monthlyBudget?.percentage || 0
        }
      };

      res.json(status);
    } catch (error) {
      sendError(res, 500, 'Failed to get system status', 'STATUS_ERROR');
    }
  });

  // Sipariş listesi
  app.get('/api/orders', async (req, res) => {
    try {
      const stats = await sheetsService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      sendError(res, 500, 'Failed to get orders', 'ORDERS_ERROR');
    }
  });

  // Sipariş detayı
  app.get('/api/orders/:orderId', async (req, res) => {
    try {
      const orderId = sanitizeString(req.params.orderId);

      if (!isValidOrderId(orderId)) {
        return sendError(res, 400, 'Invalid order ID format', 'INVALID_ORDER_ID');
      }

      const order = await sheetsService.getOrder(orderId);

      if (!order) {
        return sendError(res, 404, 'Order not found', 'ORDER_NOT_FOUND');
      }

      const costReport = costTracker.getOrderReport(orderId);

      res.json({
        ...order,
        costReport
      });
    } catch (error) {
      sendError(res, 500, 'Failed to get order details', 'ORDER_DETAIL_ERROR');
    }
  });

  // Ajan durumları
  app.get('/api/agents', (req, res) => {
    try {
      res.json(getAgentStatuses());
    } catch (error) {
      sendError(res, 500, 'Failed to get agent statuses', 'AGENTS_ERROR');
    }
  });

  // Bütçe durumu
  app.get('/api/budget', (req, res) => {
    try {
      const stats = costTracker.getGlobalStats();
      res.json(stats);
    } catch (error) {
      sendError(res, 500, 'Failed to get budget info', 'BUDGET_ERROR');
    }
  });

  // Manuel sipariş ekleme (stricter rate limit)
  app.post('/api/orders', rateLimitMiddleware(orderRateLimiter), async (req, res) => {
    try {
      const { customerName, customerEmail, productName, etsyOrderId } = req.body;

      // Validation
      if (!customerName || !productName) {
        return sendError(res, 400, 'customerName and productName required', 'VALIDATION_ERROR');
      }

      // Sanitization
      const sanitizedData = {
        customerName: sanitizeString(customerName),
        customerEmail: sanitizeString(customerEmail),
        productName: sanitizeString(productName),
        etsyOrderId: etsyOrderId ? sanitizeString(etsyOrderId) : `MANUAL-${Date.now()}`
      };

      // Email validation
      if (sanitizedData.customerEmail && !isValidEmail(sanitizedData.customerEmail)) {
        return sendError(res, 400, 'Invalid email format', 'INVALID_EMAIL');
      }

      // Length checks
      if (sanitizedData.customerName.length < 2 || sanitizedData.customerName.length > 100) {
        return sendError(res, 400, 'customerName must be 2-100 characters', 'INVALID_NAME');
      }

      if (sanitizedData.productName.length < 2 || sanitizedData.productName.length > 200) {
        return sendError(res, 400, 'productName must be 2-200 characters', 'INVALID_PRODUCT');
      }

      const orderId = await sheetsService.addOrder(sanitizedData);

      logger.info('Manual order created', { orderId });
      res.status(201).json({ orderId, message: 'Order created successfully' });
    } catch (error) {
      sendError(res, 500, 'Failed to create order', 'CREATE_ORDER_ERROR');
    }
  });

  // Sipariş durumu güncelleme
  app.patch('/api/orders/:orderId/status', async (req, res) => {
    try {
      const orderId = sanitizeString(req.params.orderId);
      const { status } = req.body;

      if (!isValidOrderId(orderId)) {
        return sendError(res, 400, 'Invalid order ID format', 'INVALID_ORDER_ID');
      }

      if (!status) {
        return sendError(res, 400, 'status required', 'VALIDATION_ERROR');
      }

      // Validate status value
      const validStatuses = Object.values(config.orderStatuses);
      if (!validStatuses.includes(status)) {
        return sendError(res, 400, 'Invalid status value', 'INVALID_STATUS');
      }

      await sheetsService.updateOrderStatus(orderId, status);

      logger.info('Order status updated', { orderId, status });
      res.json({ message: 'Status updated successfully' });
    } catch (error) {
      sendError(res, 500, 'Failed to update status', 'UPDATE_STATUS_ERROR');
    }
  });

  // Ajan kontrolü
  app.post('/api/agents/:agentName/action', async (req, res) => {
    try {
      const { action } = req.body;
      const agentName = sanitizeString(req.params.agentName);

      const validActions = ['pause', 'resume', 'stop'];
      if (!validActions.includes(action)) {
        return sendError(res, 400, 'Invalid action', 'INVALID_ACTION');
      }

      const agent = findAgent(agentName);

      if (!agent) {
        return sendError(res, 404, 'Agent not found', 'AGENT_NOT_FOUND');
      }

      switch (action) {
        case 'pause':
          agent.pause();
          break;
        case 'resume':
          agent.resume();
          break;
        case 'stop':
          await agent.stop();
          break;
      }

      logger.info('Agent action executed', { agentName, action });
      res.json({ message: `${agentName} ${action} executed successfully` });
    } catch (error) {
      sendError(res, 500, 'Failed to execute agent action', 'AGENT_ACTION_ERROR');
    }
  });

  // Sistem metrikleri (SSE) - with memory leak fixes
  app.get('/api/metrics/stream', (req, res) => {
    // Check connection limit
    if (activeConnections.size >= MAX_SSE_CONNECTIONS) {
      return sendError(res, 503, 'Too many active connections', 'CONNECTION_LIMIT');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Track connection
    activeConnections.add(res);

    const sendMetrics = () => {
      try {
        const data = {
          timestamp: new Date().toISOString(),
          agents: getAgentStatuses(),
          budget: costTracker.getGlobalStats(),
          connections: activeConnections.size
        };

        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        cleanup();
      }
    };

    // İlk veri
    sendMetrics();

    // Her N saniyede güncelle (config'den)
    const interval = setInterval(sendMetrics, config.dashboard.sseUpdateIntervalMs);

    // Connection timeout (memory leak fix)
    const timeout = setTimeout(() => {
      logger.debug('SSE connection timeout');
      cleanup();
    }, SSE_TIMEOUT_MS);

    // Cleanup function
    const cleanup = () => {
      clearInterval(interval);
      clearTimeout(timeout);
      activeConnections.delete(res);
      if (!res.writableEnded) {
        res.end();
      }
    };

    // Handle client disconnect
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
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
