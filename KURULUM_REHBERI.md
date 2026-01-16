# Rejista - Adım Adım Kurulum Rehberi

Bu rehber, bilgisayar konusunda deneyimi olmayan kişiler için hazırlanmıştır.
Her adımı sırayla takip edin. Bir adımı atlamayın.

---

## İÇİNDEKİLER

1. [Başlamadan Önce Bilmeniz Gerekenler](#1-başlamadan-önce-bilmeniz-gerekenler)
2. [Node.js Kurulumu](#2-nodejs-kurulumu)
3. [Proje Dosyalarını İndirme](#3-proje-dosyalarını-indirme)
4. [Google Cloud Hesabı Oluşturma](#4-google-cloud-hesabı-oluşturma)
5. [Google Sheets Hazırlama](#5-google-sheets-hazırlama)
6. [Google Drive Klasörü Oluşturma](#6-google-drive-klasörü-oluşturma)
7. [Gemini API Anahtarı Alma](#7-gemini-api-anahtarı-alma)
8. [Ayar Dosyasını Düzenleme](#8-ayar-dosyasını-düzenleme)
9. [Programı Çalıştırma](#9-programı-çalıştırma)
10. [Sorun Giderme](#10-sorun-giderme)

---

## 1. BAŞLAMADAN ÖNCE BİLMENİZ GEREKENLER

### Bu sistem ne yapar?
- Etsy mağazanıza sipariş geldiğinde otomatik olarak ürün videosu üretir
- Hiçbir müdahale gerektirmez, her şey otomatik çalışır

### Ne lazım?
- Bir bilgisayar (Windows, Mac veya Linux)
- İnternet bağlantısı
- Google hesabı (Gmail)
- Etsy mağazası (opsiyonel, test için gerekli değil)

### Tahmini süre?
- İlk kurulum: 30-45 dakika
- Bir kez kurunca, her şey otomatik çalışır

---

## 2. NODE.JS KURULUMU

Node.js, programımızın çalışması için gereken bir yazılımdır.

### Windows için:

**Adım 2.1:** Tarayıcınızı açın (Chrome, Edge, Firefox vb.)

**Adım 2.2:** Adres çubuğuna şunu yazın ve Enter'a basın:
```
https://nodejs.org
```

**Adım 2.3:** Açılan sayfada yeşil renkli **"LTS"** yazan büyük butona tıklayın.
- LTS = Uzun Süreli Destek demektir, daha güvenilirdir

**Adım 2.4:** Dosya indirilecek. İndirme tamamlanınca dosyaya çift tıklayın.

**Adım 2.5:** Kurulum penceresi açılacak:
- "Next" butonuna tıklayın
- "I accept the terms..." kutusunu işaretleyin
- "Next" butonuna tıklayın
- "Next" butonuna tıklayın (yolu değiştirmeyin)
- "Next" butonuna tıklayın
- "Install" butonuna tıklayın
- Bilgisayar izin isterse "Evet" deyin
- "Finish" butonuna tıklayın

**Adım 2.6:** Kurulumu doğrulayın:
- Klavyede Windows tuşu + R tuşuna basın
- Açılan kutuya `cmd` yazın ve Enter'a basın
- Siyah ekran açılacak, şunu yazın ve Enter'a basın:
```
node --version
```
- `v20.x.x` gibi bir numara görmelisiniz
- Bu ekranı kapatmayın, lazım olacak

### Mac için:

**Adım 2.1:** Tarayıcınızı açın (Safari, Chrome vb.)

**Adım 2.2:** Şu adrese gidin:
```
https://nodejs.org
```

**Adım 2.3:** Yeşil **"LTS"** butonuna tıklayın.

**Adım 2.4:** İndirilen .pkg dosyasına çift tıklayın.

**Adım 2.5:** Kurulum adımlarını takip edin:
- "Continue" → "Continue" → "Agree" → "Install"
- Şifrenizi girin
- "Close"

**Adım 2.6:** Doğrulama:
- Spotlight'ı açın (Cmd + Space)
- "Terminal" yazın ve açın
- Şunu yazın:
```
node --version
```
- Versiyon numarası görmelisiniz

---

## 3. PROJE DOSYALARINI İNDİRME

### Adım 3.1: Proje klasörüne gidin

**Windows için:**
Komut satırında (siyah ekran) şunu yazın:
```
cd C:\Users\%USERNAME%\Desktop
```
Enter'a basın.

**Mac için:**
Terminal'de şunu yazın:
```
cd ~/Desktop
```
Enter'a basın.

### Adım 3.2: Projeyi indirin

Şimdi şu komutu yazın ve Enter'a basın:
```
git clone https://github.com/kemalkirazci/cihaz.git
```

**NOT:** Eğer "git bulunamadı" hatası alırsanız:
- Windows: https://git-scm.com adresinden Git'i indirin ve kurun
- Mac: Terminalde `xcode-select --install` yazın

### Adım 3.3: Proje klasörüne girin

```
cd cihaz
```

### Adım 3.4: Gerekli paketleri yükleyin

```
npm install
```

Bu komut biraz sürebilir (1-5 dakika). Bekleyin.
Bitince yeni bir satır görürsünüz.

---

## 4. GOOGLE CLOUD HESABI OLUŞTURMA

Bu adım biraz uzun ama sadece bir kez yapacaksınız.

### Adım 4.1: Google Cloud'a gidin

Tarayıcınızda şu adrese gidin:
```
https://console.cloud.google.com
```

### Adım 4.2: Google hesabınızla giriş yapın

Gmail hesabınızla giriş yapın. Yoksa "Hesap oluştur"a tıklayın.

### Adım 4.3: Yeni proje oluşturun

1. Sayfanın en üstünde "Select a project" yazısına tıklayın
2. Açılan pencerede "NEW PROJECT" butonuna tıklayın
3. Project name kısmına yazın: `rejista-video`
4. "CREATE" butonuna tıklayın
5. 30 saniye bekleyin, proje oluşacak

### Adım 4.4: Proje ID'sini not edin

1. Proje oluşturulduktan sonra sol üstte proje adına tıklayın
2. Açılan listede projenizin altında küçük harflerle yazılı ID'yi görün
3. Bu ID'yi bir yere not edin (örnek: `rejista-video-12345`)

### Adım 4.5: API'leri etkinleştirin

1. Sol menüde "APIs & Services" tıklayın
2. "+ ENABLE APIS AND SERVICES" butonuna tıklayın
3. Arama kutusuna `sheets` yazın
4. "Google Sheets API" tıklayın
5. "ENABLE" butonuna tıklayın

Aynı işlemi şunlar için tekrarlayın:
- `drive` arayın → "Google Drive API" → ENABLE
- `gmail` arayın → "Gmail API" → ENABLE
- `vertex` arayın → "Vertex AI API" → ENABLE

### Adım 4.6: Hizmet hesabı oluşturun

1. Sol menüde "IAM & Admin" → "Service Accounts" tıklayın
2. "+ CREATE SERVICE ACCOUNT" butonuna tıklayın
3. Bilgileri girin:
   - Service account name: `rejista-service`
   - Service account ID: otomatik dolacak
4. "CREATE AND CONTINUE" tıklayın
5. Role seçin: "Basic" → "Editor"
6. "CONTINUE" tıklayın
7. "DONE" tıklayın

### Adım 4.7: Anahtar dosyası indirin

1. Oluşturduğunuz hesabın satırındaki 3 noktaya (⋮) tıklayın
2. "Manage keys" tıklayın
3. "ADD KEY" → "Create new key" tıklayın
4. "JSON" seçili olsun → "CREATE" tıklayın
5. Bir dosya indirilecek (ör: `rejista-video-xxxxx.json`)
6. Bu dosyayı proje klasörüne taşıyın:
   - Windows: `C:\Users\[KullanıcıAdınız]\Desktop\cihaz\`
   - Mac: Masaüstündeki `cihaz` klasörü

**ÖNEMLİ:** Bu dosyayı kimseyle paylaşmayın!

---

## 5. GOOGLE SHEETS HAZIRLAMAK

### Adım 5.1: Yeni tablo oluşturun

1. Şu adrese gidin: https://sheets.google.com
2. "+" işaretine tıklayarak yeni tablo oluşturun
3. Tabloya isim verin: "Rejista Siparişler"

### Adım 5.2: Sütun başlıklarını ekleyin

İlk satıra (1. satır) şu başlıkları yazın (her hücreye bir tane):

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| orderId | customerName | customerEmail | etsyOrderId | productName | status | driveFolderId | analysisJson | concepts | videoUrls | totalCost | notes |

### Adım 5.3: Sheets ID'sini not edin

1. Tarayıcının adres çubuğuna bakın
2. URL şöyle görünecek:
   ```
   https://docs.google.com/spreadsheets/d/ABC123XYZ789/edit
   ```
3. `ABC123XYZ789` kısmını kopyalayın - bu sizin Sheets ID'niz
4. Bir yere not edin

### Adım 5.4: Tabloyu paylaşın

1. Sağ üstte "Paylaş" butonuna tıklayın
2. "Kişi veya grup ekle" kısmına hizmet hesabı e-postasını yazın:
   - Bu e-posta Google Cloud'da Service Account sayfasında yazan e-posta
   - Şuna benzer: `rejista-service@rejista-video-12345.iam.gserviceaccount.com`
3. "Düzenleyici" seçin
4. "Gönder" tıklayın

---

## 6. GOOGLE DRIVE KLASÖRÜ OLUŞTURMA

### Adım 6.1: Yeni klasör oluşturun

1. Şu adrese gidin: https://drive.google.com
2. Sol tarafta "+ Yeni" butonuna tıklayın
3. "Klasör" seçin
4. İsim verin: "Rejista Videolar"
5. "Oluştur" tıklayın

### Adım 6.2: Klasör ID'sini not edin

1. Oluşturduğunuz klasöre çift tıklayarak açın
2. Adres çubuğuna bakın:
   ```
   https://drive.google.com/drive/folders/ABC123XYZ789
   ```
3. `ABC123XYZ789` kısmını kopyalayın - bu sizin Drive Folder ID'niz
4. Bir yere not edin

### Adım 6.3: Klasörü paylaşın

1. Klasöre sağ tıklayın → "Paylaş" seçin
2. Hizmet hesabı e-postasını ekleyin (önceki adımdaki gibi)
3. "Düzenleyici" seçin
4. "Gönder" tıklayın

---

## 7. GEMINI API ANAHTARI ALMA

### Adım 7.1: AI Studio'ya gidin

Tarayıcınızda şu adrese gidin:
```
https://aistudio.google.com/app/apikey
```

### Adım 7.2: API anahtarı oluşturun

1. Google hesabınızla giriş yapın
2. "Create API Key" butonuna tıklayın
3. Projenizi seçin (rejista-video)
4. "Create API Key in existing project" tıklayın

### Adım 7.3: Anahtarı kopyalayın

1. Oluşan anahtar ekranda görünecek
2. "Copy" butonuna tıklayın
3. Bir yere not edin (şuna benzer: `AIzaSyB1234567890abcdef`)

**ÖNEMLİ:** Bu anahtarı kimseyle paylaşmayın!

---

## 8. AYAR DOSYASINI DÜZENLEME

### Adım 8.1: Örnek dosyayı kopyalayın

**Windows için:**
Komut satırında şunu yazın:
```
copy .env.example .env
```

**Mac için:**
Terminalde şunu yazın:
```
cp .env.example .env
```

### Adım 8.2: Dosyayı düzenleyin

**Windows için:**
```
notepad .env
```

**Mac için:**
```
nano .env
```

### Adım 8.3: Değerleri girin

Dosyada şu satırları bulun ve not ettiğiniz değerleri yazın:

```env
# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=rejista-video-12345
GOOGLE_APPLICATION_CREDENTIALS=./rejista-video-xxxxx.json

# Gemini AI
GEMINI_API_KEY=AIzaSyB1234567890abcdef

# Workspace
GOOGLE_SHEETS_ID=ABC123XYZ789
GOOGLE_DRIVE_FOLDER_ID=ABC123XYZ789
GMAIL_USER=sizin-email@gmail.com

# Dashboard Güvenlik (kendiniz bir şifre belirleyin)
DASHBOARD_SECRET=guclu-bir-sifre-123
```

### Adım 8.4: Dosyayı kaydedin

**Windows (Notepad):**
- Ctrl + S tuşlarına basın
- Pencereyi kapatın

**Mac (nano):**
- Ctrl + X tuşlarına basın
- "Y" tuşuna basın
- Enter tuşuna basın

---

## 9. PROGRAMI ÇALIŞTIRMA

### Adım 9.1: Programı başlatın

Komut satırında/Terminal'de şunu yazın:
```
npm start
```

### Adım 9.2: Kontrol edin

Şu mesajları görmelisiniz:
```
✅ Konfigürasyon doğrulaması başarılı
🚀 Rejista başlatılıyor...
📊 Dashboard: http://localhost:8080
```

### Adım 9.3: Dashboard'u açın

1. Tarayıcınızı açın
2. Adres çubuğuna yazın: `http://localhost:8080`
3. API Key kısmına `.env` dosyasındaki `DASHBOARD_SECRET` değerini girin

### Adım 9.4: Test siparişi oluşturun

1. Dashboard'da "Yeni Sipariş" butonuna tıklayın
2. Test bilgilerini girin:
   - Müşteri Adı: Test Müşteri
   - E-posta: test@test.com
   - Ürün Adı: Test Ürün
3. "Oluştur" butonuna tıklayın

### Adım 9.5: Durumu izleyin

- Sipariş sırayla şu aşamalardan geçer:
  1. Analiz Bekliyor
  2. Analiz Ediliyor
  3. Konsept Hazır
  4. Video Üretiliyor
  5. Kalite Kontrol
  6. Tamamlandı

---

## 10. SORUN GİDERME

### Hata: "npm command not found"
**Çözüm:** Node.js düzgün kurulmamış. 2. adımı tekrarlayın.

### Hata: "GOOGLE_APPLICATION_CREDENTIALS not found"
**Çözüm:**
1. JSON dosyasının doğru klasörde olduğundan emin olun
2. `.env` dosyasındaki yolu kontrol edin

### Hata: "Permission denied"
**Çözüm:**
1. Google Sheets ve Drive'ı hizmet hesabıyla paylaştığınızdan emin olun
2. E-posta adresini doğru yazdığınızdan emin olun

### Hata: "Invalid API key"
**Çözüm:**
1. Gemini API anahtarını doğru kopyaladığınızdan emin olun
2. Anahtarın başında/sonunda boşluk olmadığından emin olun

### Hata: "Port already in use"
**Çözüm:**
Başka bir program 8080 portunu kullanıyor. `.env` dosyasında şunu değiştirin:
```
DASHBOARD_PORT=8081
```

### Dashboard açılmıyor
**Çözüm:**
1. Program çalışıyor mu kontrol edin
2. `http://localhost:8080` yerine `http://127.0.0.1:8080` deneyin

### Program dondu/yanıt vermiyor
**Çözüm:**
1. Ctrl + C tuşlarına basarak durdurun
2. `npm start` ile tekrar başlatın

---

## YARDIMCI İPUÇLARI

### Programı arka planda çalıştırma

**Windows için:**
```
start /B npm start
```

**Mac/Linux için:**
```
npm start &
```

### Logları görüntüleme
```
cd logs
```
Klasördeki dosyaları açarak detaylı kayıtları görebilirsiniz.

### Programı durdurma
- Çalıştığı pencerede Ctrl + C tuşlarına basın

### Her gün otomatik başlatma

**Windows için:**
1. `başlat.bat` adında bir dosya oluşturun
2. İçine yazın:
   ```
   cd C:\Users\[KullanıcıAdınız]\Desktop\cihaz
   npm start
   ```
3. Bu dosyayı Başlangıç klasörüne koyun:
   - Windows + R → `shell:startup` → Enter

**Mac için:**
1. Terminal'de şunu yazın:
   ```
   crontab -e
   ```
2. Şu satırı ekleyin:
   ```
   @reboot cd ~/Desktop/cihaz && npm start
   ```

---

## DESTEK

Sorun yaşarsanız:
1. Bu rehberdeki "Sorun Giderme" bölümüne bakın
2. GitHub Issues sayfasında benzer sorun var mı kontrol edin
3. Yeni bir Issue açarak yardım isteyin

---

**Tebrikler!** Rejista'yı başarıyla kurdunuz. Sistem artık Etsy siparişleriniz için otomatik video üretecek.
