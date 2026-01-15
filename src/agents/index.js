/**
 * Rejista - Ajan Sistemi Index
 * Tüm ajanları dışa aktarır
 */

export { BaseAgent } from './BaseAgent.js';
export { ModeratorAgent, moderatorAgent } from './ModeratorAgent.js';
export { ContentAnalyzerAgent, contentAnalyzerAgent } from './ContentAnalyzerAgent.js';
export { ProductionAgent, createProductionAgents } from './ProductionAgent.js';

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

  return {
    moderator: moderatorAgent,
    contentAnalyzer: contentAnalyzerAgent,
    productionAgents
  };
}

/**
 * Tüm ajanları başlat
 * @param {object} agents - Ajan referansları
 */
export async function startAllAgents(agents) {
  const { moderator, contentAnalyzer, productionAgents } = agents;

  // Ajanları başlat
  await contentAnalyzer.start();

  for (const agent of productionAgents) {
    await agent.start();
  }

  // Moderator en son başlasın
  await moderator.start();

  // Run loop'ları başlat (paralel)
  Promise.all([
    moderator.runLoop(),
    contentAnalyzer.runLoop(),
    ...productionAgents.map((a) => a.runLoop())
  ]).catch((error) => {
    console.error('Ajan döngü hatası:', error);
  });
}

/**
 * Tüm ajanları durdur
 * @param {object} agents - Ajan referansları
 */
export async function stopAllAgents(agents) {
  const { moderator, contentAnalyzer, productionAgents } = agents;

  // Önce moderator'ı durdur
  await moderator.stop();

  // Sonra diğerlerini
  await contentAnalyzer.stop();

  for (const agent of productionAgents) {
    await agent.stop();
  }
}

export default {
  initializeAgents,
  startAllAgents,
  stopAllAgents
};
