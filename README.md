# 🎬 Rejista - Otonom Video Üretim Ekosistemi

<div align="center">

![Rejista Logo](https://via.placeholder.com/200x200?text=Rejista)

**Etsy siparişlerini otomatik olarak profesyonel ticari videolara dönüştüren AI-powered sistem**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Enabled-blue.svg)](https://cloud.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-1.5%20Pro-purple.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📋 İçindekiler

- [Genel Bakış](#-genel-bakış)
- [Özellikler](#-özellikler)
- [Mimari](#-mimari)
- [Kurulum](#-kurulum)
- [Konfigürasyon](#-konfigürasyon)
- [Kullanım](#-kullanım)
- [AI Ajanları](#-ai-ajanları)
- [API Referansı](#-api-referansı)
- [Dashboard](#-dashboard)
- [Maliyet Yönetimi](#-maliyet-yönetimi)
- [Katkıda Bulunma](#-katkıda-bulunma)

---

## 🎯 Genel Bakış

Rejista, e-ticaret satıcıları için tasarlanmış tam otonom bir video üretim fabrikasıdır. Sistem, Etsy üzerinden gelen siparişleri otomatik olarak algılar ve AI ajanları kullanarak profesyonel ticari videolar üretir.

### Temel Vizyon

- **🎯 Ticari Odak**: Sanatsal kaygı yerine, satış odaklı ve maliyet verimli üretim
- **🤖 Sıfır İnsan Müdahalesi**: Siparişin düşmesinden teslimata kadar tüm süreç AI tarafından yönetilir
- **💰 Maliyet Kontrolü**: Sipariş başına maksimum $5.00 üretim maliyeti hedefi

---

## ✨ Özellikler

### 🔄 Otomatik İş Akışı
- Gmail'den Etsy sipariş maillerini otomatik algılama
- Ürün görsellerinin AI ile analizi
- 3 farklı video konsepti üretimi (Enerjik, Minimal, Sinematik)
- Otomatik kalite kontrolü
- Müşteriye otomatik teslimat

### 🧠 AI Destekli
- **Gemini 1.5 Pro/Flash**: Görsel analiz ve strateji oluşturma
- **Vertex AI / Veo 2**: Profesyonel video üretimi
- **Imagen 3**: Fallback görüntü üretimi

### 📊 Yönetim
- Gerçek zamanlı dashboard
- Maliyet takibi ve bütçe kontrolü
- Ajan durumu izleme
- Detaylı raporlama

---

## 🏗 Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        REJISTA ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │  Gmail   │───▶│ Apps Script  │───▶│   Google Sheets      │   │
│  │  Inbox   │    │  Trigger     │    │   (Central DB)       │   │
│  └──────────┘    └──────────────┘    └──────────────────────┘   │
│                         │                      ▲                 │
│                         ▼                      │                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    NODE.JS BACKEND                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │   │
│  │  │ Moderator  │  │  Content   │  │    Production      │  │   │
│  │  │   Agent    │──│  Analyzer  │──│     Agents (3x)    │  │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                 │                     │                │
│         ▼                 ▼                     ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Gemini AI  │  │ Google Drive │  │     Vertex AI        │   │
│  │  (Analysis)  │  │  (Storage)   │  │   (Video Gen)        │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Kurulum

### Önkoşullar

- Node.js 20+
- Google Cloud Platform hesabı
- Gemini API anahtarı
- Google Workspace erişimi

### Adım 1: Projeyi Klonlayın

```bash
git clone https://github.com/yourusername/rejista.git
cd rejista
```

### Adım 2: Bağımlılıkları Yükleyin

```bash
npm install
```

### Adım 3: Ortam Değişkenlerini Ayarlayın

```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

### Adım 4: Google Cloud Kurulumu

1. GCP Console'da yeni proje oluşturun
2. Gerekli API'leri etkinleştirin:
   - Google Sheets API
   - Google Drive API
   - Gmail API
   - Vertex AI API
3. Service Account oluşturun ve JSON key'i indirin

### Adım 5: Apps Script Kurulumu

1. [Google Apps Script](https://script.google.com)'e gidin
2. Yeni proje oluşturun
3. `apps-script/Code.gs` içeriğini yapıştırın
4. CONFIG değerlerini doldurun
5. `setupTriggers()` fonksiyonunu çalıştırın

### Adım 6: Sistemi Başlatın

```bash
npm start
```

---

## ⚙️ Konfigürasyon

### Ortam Değişkenleri

```env
# Google Cloud Platform
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Google Workspace
GOOGLE_SHEETS_ID=your-spreadsheet-id
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id

# Maliyet Limitleri
MAX_COST_PER_ORDER=5.00
DAILY_BUDGET_LIMIT=100.00
MONTHLY_BUDGET_LIMIT=2000.00
```

### Maliyet Ayarları

| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| `MAX_COST_PER_ORDER` | $5.00 | Sipariş başına maksimum maliyet |
| `DAILY_BUDGET_LIMIT` | $100.00 | Günlük bütçe limiti |
| `MONTHLY_BUDGET_LIMIT` | $2000.00 | Aylık bütçe limiti |

---

## 📖 Kullanım

### Otomatik Mod

Sistem varsayılan olarak otomatik çalışır:

1. Gmail'e Etsy sipariş maili düşer
2. Apps Script maili algılar ve işler
3. AI ajanları video üretim sürecini başlatır
4. Müşteriye otomatik bildirim gönderilir

### Manuel Sipariş Ekleme

Dashboard üzerinden veya API ile manuel sipariş ekleyebilirsiniz:

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "productName": "Handmade Necklace"
  }'
```

---

## 🤖 AI Ajanları

### Moderator Agent
- **Rol**: Sistem koordinatörü
- **Sorumluluklar**:
  - Yeni siparişleri tespit etme
  - Ajanlar arası koordinasyon
  - Bütçe yönetimi
  - Hata kurtarma

### Content Analyzer Agent
- **Rol**: Görsel analiz uzmanı
- **Sorumluluklar**:
  - Ürün fotoğraflarını analiz etme
  - Renk paleti, mood çıkarma
  - Video konseptleri oluşturma

### Production Agents (3x)
- **Roller**: Enerjik, Minimal, Sinematik
- **Sorumluluklar**:
  - Video promptları yazma
  - Vertex AI ile video üretme
  - Kalite kontrolü

---

## 📡 API Referansı

### Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/status` | Sistem durumu |
| GET | `/api/orders` | Sipariş listesi |
| GET | `/api/orders/:id` | Sipariş detayı |
| POST | `/api/orders` | Yeni sipariş |
| PATCH | `/api/orders/:id/status` | Durum güncelleme |
| GET | `/api/agents` | Ajan durumları |
| GET | `/api/budget` | Bütçe durumu |

### Örnek Yanıtlar

```json
// GET /api/status
{
  "system": {
    "status": "running",
    "uptime": 3600
  },
  "agents": [...],
  "budget": {
    "dailyTotal": 12.50,
    "monthlyTotal": 450.00
  }
}
```

---

## 📊 Dashboard

Dashboard `http://localhost:8080` adresinde çalışır ve şunları gösterir:

- 📈 Anlık sipariş istatistikleri
- 🤖 Ajan durumları ve performansı
- 💰 Bütçe kullanımı
- 📋 Son aktiviteler
- ⚙️ Sistem kontrolleri

---

## 💰 Maliyet Yönetimi

### Maliyet Yapısı (Tahmini)

| İşlem | Birim Maliyet |
|-------|---------------|
| Gemini Pro Input | $1.25 / 1M token |
| Gemini Pro Output | $5.00 / 1M token |
| Gemini Flash Input | $0.075 / 1M token |
| Gemini Flash Output | $0.30 / 1M token |
| Video Render | $0.02 / saniye |
| Storage | $0.02 / GB / ay |

### Tipik Sipariş Maliyeti

| Aşama | Tahmini Maliyet |
|-------|-----------------|
| Görsel Analizi | $0.50 |
| Konsept Oluşturma | $0.30 |
| 3x Video Üretimi | $3.60 |
| Depolama | $0.10 |
| **Toplam** | **$4.50** |

---

## 🔧 Geliştirme

### Proje Yapısı

```
rejista/
├── src/
│   ├── agents/           # AI Ajanları
│   ├── config/           # Konfigürasyon
│   ├── dashboard/        # Dashboard UI
│   ├── services/         # Google servisleri
│   ├── utils/            # Yardımcı fonksiyonlar
│   └── index.js          # Ana giriş noktası
├── apps-script/          # Google Apps Script
├── logs/                 # Log dosyaları
├── package.json
└── README.md
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📞 İletişim

- **Proje**: [GitHub Issues](https://github.com/yourusername/rejista/issues)
- **Email**: support@rejista.io

---

<div align="center">

**Rejista ile video üretimini otomatikleştirin! 🎬**

Made with ❤️ by Rejista Team

</div>
