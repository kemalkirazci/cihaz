/**
 * Rejista - Ajan Sistemi Index
 * Tüm ajanları dışa aktarır
 *
 * İYİLEŞTİRMELER:
 * - Proper Promise rejection handling
 * - Agent health monitoring
 * - Graceful error recovery
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export { BaseAgent } from './BaseAgent.js';
export { ModeratorAgent, moderatorAgent } from './ModeratorAgent.js';
export { ContentAnalyzerAgent, contentAnalyzerAgent } from './ContentAnalyzerAgent.js';
export { ProductionAgent, createProductionAgents } from './ProductionAgent.js';

// Active agent loops tracking
const activeLoops = new Map();
let shutdownRequested = false;

/**
 * Tüm ajanları başlat ve bağla
 * @returns {object} - Ajan referansları
 */
export async function initializeAgents() {
  const { moderatorAgent } = await import('./ModeratorAgent.js');
  const { contentAnalyzerAgent } = await import('./ContentAnalyzerAgent.js');
  const { createProductionAgents } = await import('./ProductionAgent.js');

  // Production ajanlarını oluştur
  const productionAgents = createProductionAgents();

  // Moderator'a bağımlılıkları ayarla
  moderatorAgent.setAgents(contentAnalyzerAgent, productionAgents);

  logger.info('Agents initialized', {
    moderator: moderatorAgent.name,
    contentAnalyzer: contentAnalyzerAgent.name,
    productionAgents: productionAgents.map(a => a.name)
  });

  return {
    moderator: moderatorAgent,
    contentAnalyzer: contentAnalyzerAgent,
    productionAgents
  };
}

/**
 * Tek bir ajanın loop'unu güvenli şekilde başlat
 */
async function startAgentLoop(agent) {
  const agentName = agent.name;

  try {
    logger.debug(`Starting loop for ${agentName}`);

    // Mevcut loop varsa önce temizle
    if (activeLoops.has(agentName)) {
      logger.warn(`Loop already running for ${agentName}, skipping`);
      return;
    }

    // Loop'u başlat ve takip et
    const loopPromise = agent.runLoop();
    activeLoops.set(agentName, loopPromise);

    // Loop sonuçlarını bekle
    await loopPromise;

    logger.info(`Agent loop completed normally: ${agentName}`);
  } catch (error) {
    logger.error(`Agent loop failed: ${agentName}`, {
      error: error.message,
      stack: error.stack
    });

    // Shutdown istenmemişse, agent'ı yeniden başlatmayı dene
    if (!shutdownRequested && agent.status !== 'error') {
      logger.info(`Attempting to restart agent loop: ${agentName}`);

      // Kısa bir beklemeden sonra yeniden başlat
      await new Promise(resolve => setTimeout(resolve, config.agents.restartDelayMs));

      if (!shutdownRequested) {
        startAgentLoop(agent).catch(e => {
          logger.error(`Failed to restart agent: ${agentName}`, { error: e.message });
        });
      }
    }
  } finally {
    activeLoops.delete(agentName);
  }
}

/**
 * Tüm ajanları başlat
 * @param {object} agents - Ajan referansları
 */
export async function startAllAgents(agents) {
  const { moderator, contentAnalyzer, productionAgents } = agents;
  shutdownRequested = false;

  try {
    // Ajanları sırayla başlat (state setup için)
    logger.info('Starting Content Analyzer agent...');
    await contentAnalyzer.start();

    for (const agent of productionAgents) {
      logger.info(`Starting ${agent.name} agent...`);
      await agent.start();
    }

    // Moderator en son başlasın (diğerlerine bağımlı)
    logger.info('Starting Moderator agent...');
    await moderator.start();

    logger.info('All agents started successfully');

    // Run loop'ları başlat (her biri kendi hata yönetimi ile)
    // NOT: Bu promise'lar await edilmiyor çünkü loop'lar sürekli çalışacak
    startAgentLoop(moderator);
    startAgentLoop(contentAnalyzer);

    for (const agent of productionAgents) {
      startAgentLoop(agent);
    }

    logger.info('All agent loops initiated');
  } catch (error) {
    logger.error('Failed to start agents', { error: error.message });
    throw error;
  }
}

/**
 * Tüm ajanları durdur
 * @param {object} agents - Ajan referansları
 */
export async function stopAllAgents(agents) {
  const { moderator, contentAnalyzer, productionAgents } = agents;
  shutdownRequested = true;

  logger.info('Stopping all agents...');

  const stopPromises = [];

  const stopTimeoutMs = config.agents.stopTimeoutMs;

  // Moderator'ı önce durdur (yeni iş atamasını engelle)
  try {
    stopPromises.push(
      Promise.race([
        moderator.stop(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Moderator stop timeout')), stopTimeoutMs)
        )
      ]).catch(e => logger.error('Error stopping Moderator', { error: e.message }))
    );
  } catch (e) {
    logger.error('Error initiating Moderator stop', { error: e.message });
  }

  // Sonra diğerlerini
  try {
    stopPromises.push(
      Promise.race([
        contentAnalyzer.stop(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ContentAnalyzer stop timeout')), stopTimeoutMs)
        )
      ]).catch(e => logger.error('Error stopping ContentAnalyzer', { error: e.message }))
    );
  } catch (e) {
    logger.error('Error initiating ContentAnalyzer stop', { error: e.message });
  }

  for (const agent of productionAgents) {
    try {
      stopPromises.push(
        Promise.race([
          agent.stop(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${agent.name} stop timeout`)), stopTimeoutMs)
          )
        ]).catch(e => logger.error(`Error stopping ${agent.name}`, { error: e.message }))
      );
    } catch (e) {
      logger.error(`Error initiating ${agent.name} stop`, { error: e.message });
    }
  }

  // Tüm stop işlemlerini bekle
  await Promise.allSettled(stopPromises);

  // Active loop'ların temizlenmesini bekle
  const loopCleanupTimeout = config.agents.loopCleanupTimeoutMs;
  const startTime = Date.now();

  while (activeLoops.size > 0 && Date.now() - startTime < loopCleanupTimeout) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (activeLoops.size > 0) {
    logger.warn(`${activeLoops.size} agent loops still active after timeout`);
  }

  logger.info('All agents stopped');
}

/**
 * Ajan sağlık durumunu al
 * @param {object} agents - Ajan referansları
 * @returns {object} - Sağlık durumu
 */
export function getAgentsHealth(agents) {
  const { moderator, contentAnalyzer, productionAgents } = agents;

  const allAgents = [moderator, contentAnalyzer, ...productionAgents];

  return {
    total: allAgents.length,
    healthy: allAgents.filter(a => a.status === 'working').length,
    paused: allAgents.filter(a => a.status === 'paused').length,
    idle: allAgents.filter(a => a.status === 'idle').length,
    error: allAgents.filter(a => a.status === 'error').length,
    activeLoops: activeLoops.size,
    agents: allAgents.map(a => ({
      name: a.name,
      status: a.status,
      taskQueue: a.taskQueue?.length || 0,
      processedCount: a.processedCount || 0,
      errorCount: a.errorCount || 0
    }))
  };
}

export default {
  initializeAgents,
  startAllAgents,
  stopAllAgents,
  getAgentsHealth
};
