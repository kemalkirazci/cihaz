/**
 * Rejista - Merkezi Loglama Sistemi
 * Winston tabanlı, yapılandırılmış logging
 */

import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Özel log formatı
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    log += `\n${stack}`;
  }

  return log;
});

// Logger instance
export const logger = winston.createLogger({
  level: config.server.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  defaultMeta: { service: 'rejista' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    // File transports
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Ajan bazlı logger factory
export function createAgentLogger(agentName) {
  return {
    info: (message, meta = {}) =>
      logger.info(`[${agentName}] ${message}`, meta),
    warn: (message, meta = {}) =>
      logger.warn(`[${agentName}] ${message}`, meta),
    error: (message, meta = {}) =>
      logger.error(`[${agentName}] ${message}`, meta),
    debug: (message, meta = {}) =>
      logger.debug(`[${agentName}] ${message}`, meta)
  };
}

// Sipariş bazlı logger factory
export function createOrderLogger(orderId) {
  return {
    info: (message, meta = {}) =>
      logger.info(message, { orderId, ...meta }),
    warn: (message, meta = {}) =>
      logger.warn(message, { orderId, ...meta }),
    error: (message, meta = {}) =>
      logger.error(message, { orderId, ...meta }),
    debug: (message, meta = {}) =>
      logger.debug(message, { orderId, ...meta })
  };
}

export default logger;
