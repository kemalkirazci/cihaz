/**
 * Rejista - Gmail Servisi
 * Etsy sipariş maillerini okuma ve müşteri bildirimleri
 */

import { google } from 'googleapis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

class GmailService {
  constructor() {
    this.gmail = null;
    this.auth = null;
    this.lastProcessedHistoryId = null;
  }

  /**
   * Servisi başlat
   */
  async initialize() {
    try {
      this.auth = new google.auth.GoogleAuth({
        keyFile: config.gcp.credentials,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify'
        ]
      });

      this.gmail = google.gmail({ version: 'v1', auth: this.auth });

      logger.info('Gmail servisi başlatıldı');
      return true;
    } catch (error) {
      logger.error('Gmail servisi başlatılamadı', { error: error.message });
      throw error;
    }
  }

  /**
   * Etsy sipariş maillerini ara
   * @param {Date} since - Bu tarihten itibaren
   * @returns {Array} - Bulunan mailler
   */
  async searchEtsyOrderEmails(since = null) {
    return withRetry(
      async () => {
        // Etsy'den gelen sipariş maillerini ara
        let query = 'from:transaction@etsy.com subject:"You sold"';

        if (since) {
          const dateStr = since.toISOString().split('T')[0].replace(/-/g, '/');
          query += ` after:${dateStr}`;
        }

        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 50
        });

        const messages = response.data.messages || [];
        const emails = [];

        for (const msg of messages) {
          const email = await this.getEmailDetails(msg.id);
          if (email) {
            emails.push(email);
          }
        }

        logger.info('Etsy sipariş mailleri tarandı', {
          found: emails.length
        });

        return emails;
      },
      { operationName: 'searchEtsyOrderEmails' }
    );
  }

  /**
   * Mail detaylarını al
   * @param {string} messageId - Mail ID
   * @returns {object} - Mail detayları
   */
  async getEmailDetails(messageId) {
    return withRetry(
      async () => {
        const response = await this.gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        const message = response.data;
        const headers = message.payload.headers;

        const getHeader = (name) => {
          const header = headers.find(
            (h) => h.name.toLowerCase() === name.toLowerCase()
          );
          return header ? header.value : null;
        };

        // Mail gövdesini çıkar
        let body = '';
        if (message.payload.body?.data) {
          body = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
        } else if (message.payload.parts) {
          for (const part of message.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf8');
              break;
            }
          }
        }

        return {
          id: messageId,
          threadId: message.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          body,
          snippet: message.snippet,
          labelIds: message.labelIds,
          internalDate: new Date(parseInt(message.internalDate))
        };
      },
      { operationName: 'getEmailDetails' }
    );
  }

  /**
   * Etsy mail'inden sipariş bilgilerini ayıkla
   * @param {object} email - Mail objesi
   * @returns {object|null} - Sipariş bilgileri
   */
  parseEtsyOrderEmail(email) {
    try {
      const body = email.body;

      // Sipariş numarasını bul
      const orderMatch = body.match(/Order #(\d+)/i) ||
        body.match(/Receipt #(\d+)/i);
      const etsyOrderId = orderMatch ? orderMatch[1] : null;

      // Müşteri adını bul
      const buyerMatch = body.match(/sold to ([^\n]+)/i) ||
        body.match(/Buyer: ([^\n]+)/i);
      const customerName = buyerMatch ? buyerMatch[1].trim() : 'Unknown';

      // Ürün adını bul
      const itemMatch = body.match(/Item: ([^\n]+)/i) ||
        body.match(/Product: ([^\n]+)/i);
      const productName = itemMatch ? itemMatch[1].trim() : email.subject;

      // Fiyatı bul
      const priceMatch = body.match(/\$([0-9.,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

      if (!etsyOrderId) {
        logger.warn('Sipariş ID bulunamadı', { emailId: email.id });
        return null;
      }

      return {
        etsyOrderId,
        customerName,
        customerEmail: this._extractEmail(email.body) || '',
        productName,
        price,
        orderDate: email.internalDate,
        emailId: email.id
      };
    } catch (error) {
      logger.error('Etsy mail parse hatası', { error: error.message });
      return null;
    }
  }

  /**
   * Email adresi ayıkla
   */
  _extractEmail(text) {
    const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Müşteriye video hazır bildirimi gönder
   * @param {string} to - Alıcı email
   * @param {string} customerName - Müşteri adı
   * @param {string} orderId - Sipariş ID
   * @param {string} driveLink - Video klasörü linki
   * @returns {boolean} - Başarı durumu
   */
  async sendDeliveryNotification(to, customerName, orderId, driveLink) {
    return withRetry(
      async () => {
        const subject = `Your Video is Ready! Order #${orderId}`;

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 Your Video is Ready!</h1>
    </div>
    <div class="content">
      <p>Hi ${customerName},</p>

      <p>Great news! Your custom product video for Order #${orderId} has been completed.</p>

      <p>We've created <strong>3 unique video variations</strong> for you:</p>
      <ul>
        <li>🚀 <strong>Energetic</strong> - Dynamic and vibrant</li>
        <li>✨ <strong>Minimal</strong> - Clean and elegant</li>
        <li>🎥 <strong>Cinematic</strong> - Dramatic and professional</li>
      </ul>

      <p>Click the button below to access your videos:</p>

      <p style="text-align: center;">
        <a href="${driveLink}" class="button">View My Videos</a>
      </p>

      <p>Feel free to use these videos for your social media, website, or any marketing materials!</p>

      <p>If you have any questions or need revisions, just reply to this email.</p>

      <p>Thank you for your order!</p>

      <p>Best regards,<br>The Rejista Team</p>
    </div>
    <div class="footer">
      <p>Powered by Rejista - Autonomous Video Production</p>
    </div>
  </div>
</body>
</html>
        `;

        const message = [
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          `To: ${to}`,
          `Subject: ${subject}`,
          '',
          htmlBody
        ].join('\n');

        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await this.gmail.users.messages.send({
          userId: 'me',
          resource: {
            raw: encodedMessage
          }
        });

        logger.info('Teslimat bildirimi gönderildi', { to, orderId });
        return true;
      },
      { operationName: 'sendDeliveryNotification' }
    );
  }

  /**
   * Hata bildirimi gönder (admin'e)
   */
  async sendErrorNotification(orderId, error, adminEmail) {
    return withRetry(
      async () => {
        const subject = `[Rejista Alert] Order #${orderId} Failed`;
        const body = `
Order Processing Failed
-----------------------
Order ID: ${orderId}
Error: ${error.message}
Time: ${new Date().toISOString()}
Stack: ${error.stack || 'N/A'}

Please check the system logs for more details.
        `;

        const message = [
          'Content-Type: text/plain; charset=utf-8',
          'MIME-Version: 1.0',
          `To: ${adminEmail}`,
          `Subject: ${subject}`,
          '',
          body
        ].join('\n');

        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await this.gmail.users.messages.send({
          userId: 'me',
          resource: {
            raw: encodedMessage
          }
        });

        logger.info('Hata bildirimi gönderildi', { orderId, adminEmail });
        return true;
      },
      { operationName: 'sendErrorNotification' }
    );
  }

  /**
   * Maili işlenmiş olarak işaretle
   * @param {string} messageId - Mail ID
   */
  async markAsProcessed(messageId) {
    return withRetry(
      async () => {
        // 'REJISTA_PROCESSED' label ekle
        await this.gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          resource: {
            addLabelIds: [],
            removeLabelIds: ['UNREAD']
          }
        });

        logger.debug('Mail işlenmiş olarak işaretlendi', { messageId });
      },
      { operationName: 'markAsProcessed' }
    );
  }
}

// Singleton instance
export const gmailService = new GmailService();

export default gmailService;
