/**
 * Rejista - Google Drive Servisi
 * Dosya depolama, klasör yönetimi ve paylaşım
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.auth = null;
    this.rootFolderId = config.workspace.driveFolderId;
  }

  /**
   * Servisi başlat
   */
  async initialize() {
    try {
      this.auth = new google.auth.GoogleAuth({
        keyFile: config.gcp.credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });

      // Root folder erişimini test et
      await this.drive.files.get({
        fileId: this.rootFolderId,
        fields: 'id, name'
      });

      logger.info('Google Drive servisi başlatıldı', {
        rootFolderId: this.rootFolderId
      });

      return true;
    } catch (error) {
      logger.error('Google Drive servisi başlatılamadı', { error: error.message });
      throw error;
    }
  }

  /**
   * Sipariş için klasör oluştur
   * @param {string} orderId - Sipariş ID
   * @param {string} customerName - Müşteri adı
   * @returns {object} - Klasör bilgileri
   */
  async createOrderFolder(orderId, customerName = '') {
    return withRetry(
      async () => {
        const folderName = `${orderId}_${customerName}_${Date.now()}`;

        const fileMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.rootFolderId]
        };

        const response = await this.drive.files.create({
          resource: fileMetadata,
          fields: 'id, name, webViewLink'
        });

        // Alt klasörler oluştur
        const subfolders = ['Gorseller', 'Videolar', 'Raporlar'];
        const subfolderIds = {};

        for (const subfolder of subfolders) {
          const subResponse = await this.drive.files.create({
            resource: {
              name: subfolder,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [response.data.id]
            },
            fields: 'id, name'
          });
          subfolderIds[subfolder.toLowerCase()] = subResponse.data.id;
        }

        logger.info('Sipariş klasörü oluşturuldu', {
          orderId,
          folderId: response.data.id
        });

        return {
          folderId: response.data.id,
          folderName: response.data.name,
          webViewLink: response.data.webViewLink,
          subfolders: subfolderIds
        };
      },
      { operationName: 'createOrderFolder' }
    );
  }

  /**
   * Dosya yükle
   * @param {string} folderId - Hedef klasör ID
   * @param {string} fileName - Dosya adı
   * @param {Buffer|Stream} content - Dosya içeriği
   * @param {string} mimeType - MIME tipi
   * @returns {object} - Dosya bilgileri
   */
  async uploadFile(folderId, fileName, content, mimeType) {
    return withRetry(
      async () => {
        const fileMetadata = {
          name: fileName,
          parents: [folderId]
        };

        // Buffer'ı stream'e çevir
        const media = {
          mimeType,
          body: content instanceof Buffer
            ? Readable.from(content)
            : content
        };

        const response = await this.drive.files.create({
          resource: fileMetadata,
          media,
          fields: 'id, name, webViewLink, webContentLink, size'
        });

        logger.info('Dosya yüklendi', {
          fileName,
          fileId: response.data.id,
          size: response.data.size
        });

        return {
          fileId: response.data.id,
          fileName: response.data.name,
          webViewLink: response.data.webViewLink,
          webContentLink: response.data.webContentLink,
          size: response.data.size
        };
      },
      { operationName: 'uploadFile' }
    );
  }

  /**
   * Dosya indir
   * @param {string} fileId - Dosya ID
   * @returns {Buffer} - Dosya içeriği
   */
  async downloadFile(fileId) {
    return withRetry(
      async () => {
        const response = await this.drive.files.get(
          {
            fileId,
            alt: 'media'
          },
          { responseType: 'arraybuffer' }
        );

        return Buffer.from(response.data);
      },
      { operationName: 'downloadFile' }
    );
  }

  /**
   * Klasördeki dosyaları listele
   * @param {string} folderId - Klasör ID
   * @param {string} mimeType - Opsiyonel MIME tipi filtresi
   * @returns {Array} - Dosya listesi
   */
  async listFiles(folderId, mimeType = null) {
    return withRetry(
      async () => {
        let query = `'${folderId}' in parents and trashed = false`;

        if (mimeType) {
          query += ` and mimeType = '${mimeType}'`;
        }

        const response = await this.drive.files.list({
          q: query,
          fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, createdTime)',
          orderBy: 'createdTime desc'
        });

        return response.data.files || [];
      },
      { operationName: 'listFiles' }
    );
  }

  /**
   * Görsel dosyalarını getir (analiz için)
   * @param {string} folderId - Görseller klasör ID
   * @returns {Array} - Görsel bilgileri ve içerikleri
   */
  async getImagesForAnalysis(folderId) {
    const imageMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    const files = await this.listFiles(folderId);
    const images = files.filter((f) =>
      imageMimeTypes.includes(f.mimeType)
    );

    const results = [];

    for (const image of images) {
      try {
        const content = await this.downloadFile(image.id);
        results.push({
          id: image.id,
          name: image.name,
          mimeType: image.mimeType,
          content: content.toString('base64'),
          size: image.size
        });
      } catch (error) {
        logger.warn('Görsel indirilemedi', {
          fileId: image.id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Dosya/klasör paylaşım izni ekle
   * @param {string} fileId - Dosya/klasör ID
   * @param {string} email - Paylaşılacak email
   * @param {string} role - İzin rolü (reader, writer, commenter)
   * @returns {string} - Paylaşım linki
   */
  async shareWithEmail(fileId, email, role = 'reader') {
    return withRetry(
      async () => {
        await this.drive.permissions.create({
          fileId,
          resource: {
            type: 'user',
            role,
            emailAddress: email
          },
          sendNotificationEmail: true
        });

        // Web view link'i al
        const file = await this.drive.files.get({
          fileId,
          fields: 'webViewLink'
        });

        logger.info('Dosya paylaşıldı', {
          fileId,
          email,
          role
        });

        return file.data.webViewLink;
      },
      { operationName: 'shareWithEmail' }
    );
  }

  /**
   * Herkese açık link oluştur
   * @param {string} fileId - Dosya ID
   * @returns {string} - Paylaşım linki
   */
  async createPublicLink(fileId) {
    return withRetry(
      async () => {
        await this.drive.permissions.create({
          fileId,
          resource: {
            type: 'anyone',
            role: 'reader'
          }
        });

        const file = await this.drive.files.get({
          fileId,
          fields: 'webViewLink, webContentLink'
        });

        return {
          viewLink: file.data.webViewLink,
          downloadLink: file.data.webContentLink
        };
      },
      { operationName: 'createPublicLink' }
    );
  }

  /**
   * Dosya sil
   * @param {string} fileId - Dosya ID
   */
  async deleteFile(fileId) {
    return withRetry(
      async () => {
        await this.drive.files.delete({ fileId });
        logger.info('Dosya silindi', { fileId });
      },
      { operationName: 'deleteFile' }
    );
  }

  /**
   * Klasör boyutunu hesapla
   * @param {string} folderId - Klasör ID
   * @returns {object} - Boyut bilgisi
   */
  async getFolderSize(folderId) {
    const files = await this.listFiles(folderId);
    let totalSize = 0;

    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subSize = await this.getFolderSize(file.id);
        totalSize += subSize.bytes;
      } else {
        totalSize += parseInt(file.size) || 0;
      }
    }

    return {
      bytes: totalSize,
      megabytes: (totalSize / (1024 * 1024)).toFixed(2),
      gigabytes: (totalSize / (1024 * 1024 * 1024)).toFixed(4)
    };
  }

  /**
   * Video dosyasını yükle ve link oluştur
   * @param {string} folderId - Video klasörü ID
   * @param {string} videoName - Video adı
   * @param {Buffer} videoContent - Video içeriği
   * @returns {object} - Video bilgileri
   */
  async uploadVideo(folderId, videoName, videoContent) {
    const uploadResult = await this.uploadFile(
      folderId,
      videoName,
      videoContent,
      'video/mp4'
    );

    // Herkese açık link oluştur
    const links = await this.createPublicLink(uploadResult.fileId);

    return {
      ...uploadResult,
      ...links
    };
  }
}

// Singleton instance
export const driveService = new GoogleDriveService();

export default driveService;
