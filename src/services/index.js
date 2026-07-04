/**
 * Rejista - Services Index
 * Tüm Google servislerini dışa aktarır
 */

export { sheetsService } from './googleSheets.js';
export { driveService } from './googleDrive.js';
export { gmailService } from './gmail.js';
export { geminiService } from './gemini.js';
export { vertexAIService } from './vertexAI.js';

/**
 * Tüm servisleri başlat
 * @returns {Promise<boolean>}
 */
export async function initializeAllServices() {
  const { sheetsService } = await import('./googleSheets.js');
  const { driveService } = await import('./googleDrive.js');
  const { gmailService } = await import('./gmail.js');
  const { geminiService } = await import('./gemini.js');
  const { vertexAIService } = await import('./vertexAI.js');

  await sheetsService.initialize();
  await driveService.initialize();
  await gmailService.initialize();
  await geminiService.initialize();
  await vertexAIService.initialize();

  return true;
}

export default {
  sheetsService,
  driveService,
  gmailService,
  geminiService,
  vertexAIService,
  initializeAllServices
};
