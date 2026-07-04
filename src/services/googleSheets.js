/**
 * Rejista - Google Sheets Servisi
 * Merkezi veritabanı ve durum takibi
 */

import { google } from 'googleapis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.spreadsheetId = config.workspace.sheetsId;

    // Sheet isimleri
    this.SHEETS = {
      ORDERS: 'Siparisler',
      COSTS: 'Maliyetler',
      AGENTS: 'Ajan_Logları',
      CONFIG: 'Ayarlar'
    };

    // Sütun haritalama
    this.COLUMNS = {
      ORDERS: {
        ORDER_ID: 'A',
        CUSTOMER_NAME: 'B',
        CUSTOMER_EMAIL: 'C',
        ETSY_ORDER_ID: 'D',
        PRODUCT_NAME: 'E',
        STATUS: 'F',
        DRIVE_FOLDER_ID: 'G',
        CREATED_AT: 'H',
        UPDATED_AT: 'I',
        ANALYSIS_JSON: 'J',
        CONCEPTS: 'K',
        VIDEO_URLS: 'L',
        TOTAL_COST: 'M',
        NOTES: 'N'
      }
    };
  }

  /**
   * Servisi başlat ve authenticate ol
   */
  async initialize() {
    try {
      // Service Account veya OAuth2 auth
      this.auth = new google.auth.GoogleAuth({
        keyFile: config.gcp.credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      // Spreadsheet erişimini test et
      await this._ensureSheetsExist();

      logger.info('Google Sheets servisi başlatıldı', {
        spreadsheetId: this.spreadsheetId
      });

      return true;
    } catch (error) {
      logger.error('Google Sheets servisi başlatılamadı', { error: error.message });
      throw error;
    }
  }

  /**
   * Gerekli sheet'lerin var olduğundan emin ol
   */
  async _ensureSheetsExist() {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const existingSheets = spreadsheet.data.sheets.map(
      (s) => s.properties.title
    );

    const sheetsToCreate = Object.values(this.SHEETS).filter(
      (name) => !existingSheets.includes(name)
    );

    if (sheetsToCreate.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: sheetsToCreate.map((title) => ({
            addSheet: { properties: { title } }
          }))
        }
      });

      // Başlık satırlarını ekle
      await this._initializeSheetHeaders();
    }
  }

  /**
   * Sheet başlıklarını oluştur
   */
  async _initializeSheetHeaders() {
    const headers = {
      [this.SHEETS.ORDERS]: [
        'Sipariş ID', 'Müşteri Adı', 'Email', 'Etsy Sipariş No',
        'Ürün Adı', 'Durum', 'Drive Klasör ID', 'Oluşturulma',
        'Güncelleme', 'Analiz JSON', 'Konseptler', 'Video URLs',
        'Toplam Maliyet', 'Notlar'
      ],
      [this.SHEETS.COSTS]: [
        'Tarih', 'Sipariş ID', 'İşlem Tipi', 'Miktar', 'Birim', 'Maliyet USD'
      ],
      [this.SHEETS.AGENTS]: [
        'Zaman', 'Ajan', 'Sipariş ID', 'Aksiyon', 'Detay', 'Durum'
      ],
      [this.SHEETS.CONFIG]: [
        'Anahtar', 'Değer', 'Açıklama'
      ]
    };

    for (const [sheetName, headerRow] of Object.entries(headers)) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [headerRow] }
      });
    }
  }

  /**
   * Yeni sipariş ekle
   * @param {object} order - Sipariş bilgileri
   * @returns {string} - Sipariş ID
   */
  async addOrder(order) {
    return withRetry(
      async () => {
        const orderId = order.orderId || `ORD-${Date.now()}`;
        const now = new Date().toISOString();

        const row = [
          orderId,
          order.customerName || '',
          order.customerEmail || '',
          order.etsyOrderId || '',
          order.productName || '',
          config.orderStatuses.PENDING,
          order.driveFolderId || '',
          now,
          now,
          '', // Analysis JSON
          '', // Concepts
          '', // Video URLs
          '0', // Total Cost
          order.notes || ''
        ];

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.SHEETS.ORDERS}!A:N`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [row] }
        });

        logger.info('Yeni sipariş eklendi', { orderId });
        return orderId;
      },
      { operationName: 'addOrder' }
    );
  }

  /**
   * Sipariş durumunu güncelle
   * @param {string} orderId - Sipariş ID
   * @param {string} status - Yeni durum
   * @param {object} additionalData - Ek veriler
   */
  async updateOrderStatus(orderId, status, additionalData = {}) {
    return withRetry(
      async () => {
        const rowIndex = await this._findOrderRow(orderId);
        if (!rowIndex) {
          throw new Error(`Sipariş bulunamadı: ${orderId}`);
        }

        const updates = [
          {
            range: `${this.SHEETS.ORDERS}!F${rowIndex}`,
            values: [[status]]
          },
          {
            range: `${this.SHEETS.ORDERS}!I${rowIndex}`,
            values: [[new Date().toISOString()]]
          }
        ];

        // Ek verileri güncelle
        if (additionalData.analysisJson) {
          updates.push({
            range: `${this.SHEETS.ORDERS}!J${rowIndex}`,
            values: [[JSON.stringify(additionalData.analysisJson)]]
          });
        }

        if (additionalData.concepts) {
          updates.push({
            range: `${this.SHEETS.ORDERS}!K${rowIndex}`,
            values: [[JSON.stringify(additionalData.concepts)]]
          });
        }

        if (additionalData.videoUrls) {
          updates.push({
            range: `${this.SHEETS.ORDERS}!L${rowIndex}`,
            values: [[JSON.stringify(additionalData.videoUrls)]]
          });
        }

        if (additionalData.totalCost !== undefined) {
          updates.push({
            range: `${this.SHEETS.ORDERS}!M${rowIndex}`,
            values: [[additionalData.totalCost.toFixed(4)]]
          });
        }

        if (additionalData.notes) {
          updates.push({
            range: `${this.SHEETS.ORDERS}!N${rowIndex}`,
            values: [[additionalData.notes]]
          });
        }

        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          resource: {
            valueInputOption: 'RAW',
            data: updates
          }
        });

        logger.info('Sipariş durumu güncellendi', { orderId, status });
      },
      { operationName: 'updateOrderStatus' }
    );
  }

  /**
   * Belirli durumdaki siparişleri getir
   * @param {string} status - Sipariş durumu
   * @returns {Array} - Siparişler
   */
  async getOrdersByStatus(status) {
    return withRetry(
      async () => {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.SHEETS.ORDERS}!A2:N`
        });

        const rows = response.data.values || [];
        const orders = [];

        for (const row of rows) {
          if (row[5] === status) { // Status column (F)
            orders.push(this._rowToOrder(row));
          }
        }

        return orders;
      },
      { operationName: 'getOrdersByStatus' }
    );
  }

  /**
   * Tek sipariş getir
   * @param {string} orderId - Sipariş ID
   * @returns {object|null} - Sipariş
   */
  async getOrder(orderId) {
    return withRetry(
      async () => {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.SHEETS.ORDERS}!A2:N`
        });

        const rows = response.data.values || [];

        for (const row of rows) {
          if (row[0] === orderId) {
            return this._rowToOrder(row);
          }
        }

        return null;
      },
      { operationName: 'getOrder' }
    );
  }

  /**
   * Sipariş satır indeksini bul
   */
  async _findOrderRow(orderId) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.SHEETS.ORDERS}!A:A`
    });

    const rows = response.data.values || [];

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === orderId) {
        return i + 1; // 1-indexed
      }
    }

    return null;
  }

  /**
   * Güvenli JSON parse
   * @private
   */
  _safeJsonParse(str, defaultValue = null) {
    if (!str || typeof str !== 'string') return defaultValue;
    try {
      return JSON.parse(str.trim());
    } catch (error) {
      logger.warn('Failed to parse JSON from Sheets', {
        preview: str.slice(0, 100),
        error: error.message
      });
      return defaultValue;
    }
  }

  /**
   * Satırı sipariş nesnesine dönüştür
   */
  _rowToOrder(row) {
    return {
      orderId: row[0] || '',
      customerName: row[1] || '',
      customerEmail: row[2] || '',
      etsyOrderId: row[3] || '',
      productName: row[4] || '',
      status: row[5] || '',
      driveFolderId: row[6] || '',
      createdAt: row[7] || '',
      updatedAt: row[8] || '',
      analysisJson: this._safeJsonParse(row[9], null),
      concepts: this._safeJsonParse(row[10], []),
      videoUrls: this._safeJsonParse(row[11], []),
      totalCost: parseFloat(row[12]) || 0,
      notes: row[13] || ''
    };
  }

  /**
   * Maliyet kaydı ekle
   */
  async addCostRecord(orderId, type, amount, unit, cost) {
    return withRetry(
      async () => {
        const row = [
          new Date().toISOString(),
          orderId,
          type,
          amount,
          unit,
          cost.toFixed(6)
        ];

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.SHEETS.COSTS}!A:F`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [row] }
        });
      },
      { operationName: 'addCostRecord' }
    );
  }

  /**
   * Ajan log kaydı ekle
   */
  async addAgentLog(agent, orderId, action, detail, status) {
    return withRetry(
      async () => {
        const row = [
          new Date().toISOString(),
          agent,
          orderId || '',
          action,
          typeof detail === 'object' ? JSON.stringify(detail) : detail,
          status
        ];

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.SHEETS.AGENTS}!A:F`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [row] }
        });
      },
      { operationName: 'addAgentLog' }
    );
  }

  /**
   * Dashboard için özet istatistikler
   */
  async getDashboardStats() {
    return withRetry(
      async () => {
        const ordersResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.SHEETS.ORDERS}!A2:N`
        });

        const rows = ordersResponse.data.values || [];
        const statuses = {};
        let totalCost = 0;
        let completedCount = 0;

        for (const row of rows) {
          const status = row[5] || 'Unknown';
          statuses[status] = (statuses[status] || 0) + 1;
          totalCost += parseFloat(row[12]) || 0;

          if (status === config.orderStatuses.COMPLETED) {
            completedCount++;
          }
        }

        return {
          totalOrders: rows.length,
          statusBreakdown: statuses,
          totalCost,
          averageCost: completedCount > 0 ? totalCost / completedCount : 0,
          completedCount
        };
      },
      { operationName: 'getDashboardStats' }
    );
  }
}

// Singleton instance
export const sheetsService = new GoogleSheetsService();

export default sheetsService;
