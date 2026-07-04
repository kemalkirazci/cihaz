/**
 * ============================================
 * REJISTA - Google Apps Script Module
 * ============================================
 *
 * Gmail triggerları ve Sheets otomasyonu için
 * Google Apps Script kodu.
 *
 * KURULUM:
 * 1. Google Apps Script'e gidin (script.google.com)
 * 2. Yeni proje oluşturun
 * 3. Bu kodu yapıştırın
 * 4. CONFIG bölümünü doldurun
 * 5. Trigger'ları ayarlayın
 */

// ==========================================
// CONFIG - Bu değerleri doldurun
// ==========================================
const CONFIG = {
  // Google Sheets ID (URL'deki /d/ sonrası)
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // Ana Drive klasörü ID
  DRIVE_FOLDER_ID: 'YOUR_DRIVE_FOLDER_ID_HERE',

  // Backend API URL (opsiyonel - webhook için)
  BACKEND_URL: 'https://your-backend-url.com',

  // Etsy'den gelen maillerin gönderici adresi
  ETSY_SENDER: 'transaction@etsy.com',

  // Sheet isimleri
  SHEETS: {
    ORDERS: 'Siparisler',
    COSTS: 'Maliyetler',
    AGENTS: 'Ajan_Logları',
    CONFIG: 'Ayarlar'
  }
};

// ==========================================
// GMAIL TRIGGER - Her 5 dakikada çalışır
// ==========================================

/**
 * Yeni Etsy sipariş maillerini kontrol et
 * Trigger: Time-driven, every 5 minutes
 */
function checkForNewEtsyOrders() {
  const sheet = getOrdersSheet();
  const existingOrderIds = getExistingOrderIds(sheet);

  // Son 1 saatteki Etsy maillerini ara
  const query = `from:${CONFIG.ETSY_SENDER} subject:"You sold" newer_than:1h`;
  const threads = GmailApp.search(query, 0, 20);

  threads.forEach(thread => {
    const messages = thread.getMessages();

    messages.forEach(message => {
      try {
        const orderInfo = parseEtsyEmail(message);

        if (orderInfo && !existingOrderIds.includes(orderInfo.etsyOrderId)) {
          // Yeni sipariş bulundu!
          processNewOrder(orderInfo, message);
        }
      } catch (error) {
        Logger.log(`Mail işleme hatası: ${error.message}`);
      }
    });
  });
}

/**
 * Etsy mail'inden sipariş bilgilerini ayıkla
 */
function parseEtsyEmail(message) {
  const body = message.getPlainBody();
  const subject = message.getSubject();

  // Sipariş numarasını bul
  const orderMatch = body.match(/Order #(\d+)/i) ||
    body.match(/Receipt #(\d+)/i) ||
    subject.match(/#(\d+)/);

  if (!orderMatch) {
    return null;
  }

  const etsyOrderId = orderMatch[1];

  // Müşteri adını bul
  const buyerMatch = body.match(/sold to ([^\n]+)/i) ||
    body.match(/Buyer: ([^\n]+)/i) ||
    body.match(/Ship to:[\s\n]+([^\n]+)/i);
  const customerName = buyerMatch ? buyerMatch[1].trim() : 'Unknown';

  // Ürün adını bul
  const itemMatch = body.match(/Item: ([^\n]+)/i) ||
    body.match(/Product: ([^\n]+)/i);
  const productName = itemMatch ? itemMatch[1].trim() : subject;

  // Fiyatı bul
  const priceMatch = body.match(/\$([0-9.,]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

  // Müşteri emaili bul
  const emailMatch = body.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const customerEmail = emailMatch ? emailMatch[1] : '';

  return {
    etsyOrderId,
    customerName,
    customerEmail,
    productName,
    price,
    orderDate: message.getDate(),
    messageId: message.getId()
  };
}

/**
 * Yeni siparişi işle
 */
function processNewOrder(orderInfo, message) {
  const orderId = `ORD-${orderInfo.etsyOrderId}`;

  Logger.log(`Yeni sipariş işleniyor: ${orderId}`);

  try {
    // 1. Drive klasörü oluştur
    const folder = createOrderFolder(orderId, orderInfo.customerName);

    // 2. Mail eklerini klasöre yükle
    const attachments = message.getAttachments();
    if (attachments.length > 0) {
      const imagesFolder = folder.getFoldersByName('Gorseller').next();

      attachments.forEach(attachment => {
        if (attachment.getContentType().startsWith('image/')) {
          imagesFolder.createFile(attachment);
        }
      });
    }

    // 3. Sheets'e ekle
    addOrderToSheet(orderId, orderInfo, folder.getId());

    // 4. Label ekle (işlenmiş olarak işaretle)
    const label = GmailApp.getUserLabelByName('Rejista/Processed') ||
      GmailApp.createLabel('Rejista/Processed');
    message.getThread().addLabel(label);

    // 5. Backend'e bildir (webhook)
    notifyBackend({
      event: 'new_order',
      orderId,
      orderInfo,
      folderId: folder.getId()
    });

    Logger.log(`Sipariş başarıyla eklendi: ${orderId}`);

  } catch (error) {
    Logger.log(`Sipariş işleme hatası: ${error.message}`);
    addErrorLog(orderId, error.message);
  }
}

// ==========================================
// DRIVE FONKSİYONLARI
// ==========================================

/**
 * Sipariş için klasör yapısı oluştur
 */
function createOrderFolder(orderId, customerName) {
  const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

  // Ana klasör
  const folderName = `${orderId}_${customerName}_${Date.now()}`;
  const orderFolder = rootFolder.createFolder(folderName);

  // Alt klasörler
  orderFolder.createFolder('Gorseller');
  orderFolder.createFolder('Videolar');
  orderFolder.createFolder('Raporlar');

  return orderFolder;
}

/**
 * Görselleri Drive'a yükle (manuel kullanım için)
 */
function uploadImagesToDrive(folderId, images) {
  const folder = DriveApp.getFolderById(folderId);
  const imagesFolder = folder.getFoldersByName('Gorseller').hasNext()
    ? folder.getFoldersByName('Gorseller').next()
    : folder;

  const uploadedFiles = [];

  images.forEach((image, index) => {
    const fileName = `image_${index + 1}.${image.mimeType.split('/')[1]}`;
    const blob = Utilities.newBlob(
      Utilities.base64Decode(image.data),
      image.mimeType,
      fileName
    );
    const file = imagesFolder.createFile(blob);
    uploadedFiles.push({
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl()
    });
  });

  return uploadedFiles;
}

// ==========================================
// SHEETS FONKSİYONLARI
// ==========================================

/**
 * Siparişler sheet'ini al
 */
function getOrdersSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.ORDERS);
    // Başlıkları ekle
    sheet.appendRow([
      'Sipariş ID', 'Müşteri Adı', 'Email', 'Etsy Sipariş No',
      'Ürün Adı', 'Durum', 'Drive Klasör ID', 'Oluşturulma',
      'Güncelleme', 'Analiz JSON', 'Konseptler', 'Video URLs',
      'Toplam Maliyet', 'Notlar'
    ]);
  }

  return sheet;
}

/**
 * Mevcut sipariş ID'lerini al
 */
function getExistingOrderIds(sheet) {
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => row[3]); // Etsy Order ID sütunu
}

/**
 * Siparişi sheet'e ekle
 */
function addOrderToSheet(orderId, orderInfo, folderId) {
  const sheet = getOrdersSheet();
  const now = new Date().toISOString();

  sheet.appendRow([
    orderId,
    orderInfo.customerName,
    orderInfo.customerEmail,
    orderInfo.etsyOrderId,
    orderInfo.productName,
    'Analiz Bekliyor', // Başlangıç durumu
    folderId,
    now,
    now,
    '', // Analysis JSON
    '', // Concepts
    '', // Video URLs
    '0', // Total Cost
    `Email ID: ${orderInfo.messageId}`
  ]);
}

/**
 * Sipariş durumunu güncelle
 */
function updateOrderStatus(orderId, newStatus, additionalData = {}) {
  const sheet = getOrdersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orderId) {
      const row = i + 1;

      // Durumu güncelle
      sheet.getRange(row, 6).setValue(newStatus);

      // Güncelleme zamanı
      sheet.getRange(row, 9).setValue(new Date().toISOString());

      // Ek verileri güncelle
      if (additionalData.analysisJson) {
        sheet.getRange(row, 10).setValue(JSON.stringify(additionalData.analysisJson));
      }
      if (additionalData.concepts) {
        sheet.getRange(row, 11).setValue(JSON.stringify(additionalData.concepts));
      }
      if (additionalData.videoUrls) {
        sheet.getRange(row, 12).setValue(JSON.stringify(additionalData.videoUrls));
      }
      if (additionalData.totalCost !== undefined) {
        sheet.getRange(row, 13).setValue(additionalData.totalCost.toFixed(4));
      }
      if (additionalData.notes) {
        sheet.getRange(row, 14).setValue(additionalData.notes);
      }

      Logger.log(`Sipariş güncellendi: ${orderId} -> ${newStatus}`);
      return true;
    }
  }

  return false;
}

/**
 * Belirli durumdaki siparişleri al
 */
function getOrdersByStatus(status) {
  const sheet = getOrdersSheet();
  const data = sheet.getDataRange().getValues();
  const orders = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === status) {
      orders.push({
        orderId: data[i][0],
        customerName: data[i][1],
        customerEmail: data[i][2],
        etsyOrderId: data[i][3],
        productName: data[i][4],
        status: data[i][5],
        driveFolderId: data[i][6],
        createdAt: data[i][7],
        updatedAt: data[i][8],
        analysisJson: data[i][9] ? JSON.parse(data[i][9]) : null,
        concepts: data[i][10] ? JSON.parse(data[i][10]) : null,
        videoUrls: data[i][11] ? JSON.parse(data[i][11]) : null,
        totalCost: parseFloat(data[i][12]) || 0,
        notes: data[i][13]
      });
    }
  }

  return orders;
}

/**
 * Hata logu ekle
 */
function addErrorLog(orderId, errorMessage) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.AGENTS);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.AGENTS);
    sheet.appendRow(['Zaman', 'Ajan', 'Sipariş ID', 'Aksiyon', 'Detay', 'Durum']);
  }

  sheet.appendRow([
    new Date().toISOString(),
    'AppsScript',
    orderId,
    'error',
    errorMessage,
    'error'
  ]);
}

// ==========================================
// BACKEND WEBHOOK
// ==========================================

/**
 * Backend'e bildirim gönder
 */
function notifyBackend(payload) {
  if (!CONFIG.BACKEND_URL || CONFIG.BACKEND_URL === 'https://your-backend-url.com') {
    Logger.log('Backend URL yapılandırılmamış, webhook atlanıyor');
    return;
  }

  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(`${CONFIG.BACKEND_URL}/api/webhook`, options);
    Logger.log(`Backend webhook yanıtı: ${response.getResponseCode()}`);

  } catch (error) {
    Logger.log(`Backend webhook hatası: ${error.message}`);
  }
}

// ==========================================
// WEB APP ENDPOINTS (doGet, doPost)
// ==========================================

/**
 * GET istekleri için handler
 */
function doGet(e) {
  const action = e.parameter.action;

  switch (action) {
    case 'status':
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);

    case 'orders':
      const status = e.parameter.status || null;
      const orders = status
        ? getOrdersByStatus(status)
        : getOrdersSheet().getDataRange().getValues().slice(1);
      return ContentService.createTextOutput(JSON.stringify(orders))
        .setMimeType(ContentService.MimeType.JSON);

    default:
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Invalid action'
      })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST istekleri için handler
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    switch (action) {
      case 'updateStatus':
        updateOrderStatus(payload.orderId, payload.status, payload.data);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);

      case 'addOrder':
        const sheet = getOrdersSheet();
        addOrderToSheet(payload.orderId, payload.orderInfo, payload.folderId);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);

      default:
        return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// TRIGGER KURULUM FONKSİYONLARI
// ==========================================

/**
 * Trigger'ları kur
 * Bu fonksiyonu bir kez manuel çalıştırın
 */
function setupTriggers() {
  // Mevcut trigger'ları temizle
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // 5 dakikada bir mail kontrolü
  ScriptApp.newTrigger('checkForNewEtsyOrders')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Trigger\'lar başarıyla kuruldu');
}

/**
 * Test fonksiyonu
 */
function testSetup() {
  Logger.log('=== Rejista Apps Script Test ===');

  // Sheets erişimi
  try {
    const sheet = getOrdersSheet();
    Logger.log(`✓ Sheets erişimi OK - Satır sayısı: ${sheet.getLastRow()}`);
  } catch (error) {
    Logger.log(`✗ Sheets hatası: ${error.message}`);
  }

  // Drive erişimi
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    Logger.log(`✓ Drive erişimi OK - Klasör: ${folder.getName()}`);
  } catch (error) {
    Logger.log(`✗ Drive hatası: ${error.message}`);
  }

  // Gmail erişimi
  try {
    const threads = GmailApp.search('from:transaction@etsy.com', 0, 1);
    Logger.log(`✓ Gmail erişimi OK - Thread sayısı: ${threads.length}`);
  } catch (error) {
    Logger.log(`✗ Gmail hatası: ${error.message}`);
  }

  Logger.log('=== Test Tamamlandı ===');
}
