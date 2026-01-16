# 🎬 REJİSTA KURULUM REHBERİ

Bilgisayar bilmeyenler için hazırlanmıştır. Her adımı sırayla yapın.

---

# 📋 NE YAPACAĞIZ?

Bu program Etsy siparişleriniz için otomatik video üretir.
Kurulum 30-45 dakika sürer. Bir kez kurunca otomatik çalışır.

---

# BÖLÜM 1: NODE.JS KURULUMU

Node.js programımızın çalışması için lazım.

---

## Adım 1.1: İnternet tarayıcınızı açın

Chrome, Edge veya Firefox açın.

---

## Adım 1.2: Node.js sitesine gidin

Üstteki adres çubuğuna şunu yazın:

```
nodejs.org
```

Enter tuşuna basın.

---

## Adım 1.3: İndirme butonuna tıklayın

Sayfada iki yeşil buton var.

**SOLDAKİ butona tıklayın** (LTS yazan)

LTS daha güvenilir versiyon demek.

---

## Adım 1.4: İndirilen dosyayı açın

Tarayıcınızın altında indirme görünür.

İndirme bitince dosyaya tıklayın.

---

## Adım 1.5: Kurulumu yapın

Pencere açılacak. Şunları yapın:

1. **Next** butonuna tıklayın
2. **Kutuyu işaretleyin** (I accept...)
3. **Next** butonuna tıklayın
4. **Next** butonuna tıklayın
5. **Next** butonuna tıklayın
6. **Install** butonuna tıklayın
7. İzin isterse **Evet** deyin
8. **Finish** butonuna tıklayın

---

## Adım 1.6: Kurulumu kontrol edin

Klavyenizde şu tuşlara birlikte basın:

**Windows tuşu + R**

(Windows tuşu: Klavyenin sol altında bayrak resmi olan tuş)

---

## Adım 1.7: Komut satırını açın

Küçük bir pencere açıldı.

Şunu yazın:

```
cmd
```

**Enter** tuşuna basın.

---

## Adım 1.8: Node.js'i test edin

Siyah ekran açıldı.

Şunu yazın:

```
node --version
```

**Enter** tuşuna basın.

---

## Adım 1.9: Sonucu kontrol edin

Ekranda şöyle bir şey görmelisiniz:

```
v20.10.0
```

(Numaralar farklı olabilir, sorun değil)

**Görüyorsanız:** Başardınız! Sonraki bölüme geçin.

**Görmüyorsanız:** 1.1'den tekrar başlayın.

---

# BÖLÜM 2: GIT KURULUMU

Git, projeyi indirmek için lazım.

---

## Adım 2.1: Git sitesine gidin

Tarayıcınızda şu adrese gidin:

```
git-scm.com
```

---

## Adım 2.2: İndirin

**Download for Windows** butonuna tıklayın.

---

## Adım 2.3: Kurun

İndirilen dosyayı açın.

Her şeye **Next** diyerek ilerleyin.

Son olarak **Install** tıklayın.

**Finish** tıklayın.

---

# BÖLÜM 3: PROJEYİ İNDİRME

---

## Adım 3.1: Komut satırını açın

**Windows tuşu + R** basın.

`cmd` yazın.

**Enter** basın.

---

## Adım 3.2: Masaüstüne gidin

Siyah ekrana şunu yazın:

```
cd Desktop
```

**Enter** basın.

---

## Adım 3.3: Projeyi indirin

Şunu yazın:

```
git clone https://github.com/kemalkirazci/cihaz.git
```

**Enter** basın.

Biraz bekleyin. İndirme bitecek.

---

## Adım 3.4: Proje klasörüne girin

Şunu yazın:

```
cd cihaz
```

**Enter** basın.

---

## Adım 3.5: Gerekli dosyaları yükleyin

Şunu yazın:

```
npm install
```

**Enter** basın.

**1-5 dakika bekleyin.** Çok şey indirilecek.

Bitince yeni satır görürsünüz.

---

# BÖLÜM 4: GOOGLE CLOUD HESABI

Bu bölüm en uzun bölüm. Ama sadece bir kez yapacaksınız.

---

## Adım 4.1: Google Cloud'a gidin

Tarayıcınızda şu adrese gidin:

```
console.cloud.google.com
```

---

## Adım 4.2: Giriş yapın

Gmail hesabınızla giriş yapın.

Gmail yoksa: **Hesap oluştur** tıklayın.

---

## Adım 4.3: Yeni proje oluşturun

Sayfanın EN ÜSTÜNde mavi çubuk var.

Orada **"Select a project"** veya **"Proje seçin"** yazar.

Tıklayın.

---

## Adım 4.4: Yeni proje butonuna tıklayın

Açılan pencerede sağ üstte:

**NEW PROJECT** veya **YENİ PROJE** butonuna tıklayın.

---

## Adım 4.5: Proje adı girin

**Project name** kutusuna şunu yazın:

```
rejista-video
```

**CREATE** butonuna tıklayın.

30 saniye bekleyin.

---

## Adım 4.6: Proje ID'sini kaydedin

Sol üstte proje adına tıklayın.

Açılan listede projenizin altında küçük yazı var.

Örnek: `rejista-video-438511`

**Bu ID'yi bir yere not edin!** Lazım olacak.

---

## Adım 4.7: API'leri açın

Sol tarafta menü var.

**APIs & Services** tıklayın.

Sonra **+ ENABLE APIS AND SERVICES** tıklayın.

---

## Adım 4.8: Sheets API'yi açın

Arama kutusuna şunu yazın:

```
sheets
```

**Google Sheets API** tıklayın.

**ENABLE** butonuna tıklayın.

---

## Adım 4.9: Drive API'yi açın

Geri dönün. (Tarayıcıda geri ok)

Arama kutusuna şunu yazın:

```
drive
```

**Google Drive API** tıklayın.

**ENABLE** butonuna tıklayın.

---

## Adım 4.10: Gmail API'yi açın

Geri dönün.

Arama kutusuna şunu yazın:

```
gmail
```

**Gmail API** tıklayın.

**ENABLE** butonuna tıklayın.

---

## Adım 4.11: Vertex AI API'yi açın

Geri dönün.

Arama kutusuna şunu yazın:

```
vertex ai api
```

**Vertex AI API** tıklayın.

**ENABLE** butonuna tıklayın.

---

## Adım 4.12: Hizmet hesabı oluşturun

Sol menüde:

**IAM & Admin** tıklayın.

Sonra **Service Accounts** tıklayın.

---

## Adım 4.13: Hesap oluşturma butonuna tıklayın

Üstte **+ CREATE SERVICE ACCOUNT** butonuna tıklayın.

---

## Adım 4.14: Hesap bilgilerini girin

**Service account name** kutusuna:

```
rejista-servis
```

**CREATE AND CONTINUE** butonuna tıklayın.

---

## Adım 4.15: Yetki verin

**Select a role** kutusuna tıklayın.

Açılan listede:

**Basic** → **Editor** seçin.

**CONTINUE** tıklayın.

**DONE** tıklayın.

---

## Adım 4.16: Anahtar dosyası oluşturun

Az önce oluşturduğunuz hesabın satırında:

Sağ tarafta **üç nokta (⋮)** var.

Tıklayın.

**Manage keys** tıklayın.

---

## Adım 4.17: Yeni anahtar oluşturun

**ADD KEY** butonuna tıklayın.

**Create new key** tıklayın.

---

## Adım 4.18: JSON seçin ve indirin

**JSON** seçili olsun.

**CREATE** butonuna tıklayın.

Bir dosya indirilecek.

**Bu dosya çok önemli! Kimseyle paylaşmayın!**

---

## Adım 4.19: Dosyayı taşıyın

İndirilen JSON dosyasını bulun.

(İndirilenler klasöründe olur)

Bu dosyayı **Masaüstündeki cihaz klasörüne** sürükleyin.

---

# BÖLÜM 5: GOOGLE SHEETS HAZIRLAMA

---

## Adım 5.1: Google Sheets'e gidin

Tarayıcınızda şu adrese gidin:

```
sheets.google.com
```

---

## Adım 5.2: Yeni tablo oluşturun

**Boş** yazan büyük **+** işaretine tıklayın.

---

## Adım 5.3: Tabloya isim verin

Sol üstte "Adsız e-tablo" yazar.

Tıklayın ve şunu yazın:

```
Rejista Siparişler
```

---

## Adım 5.4: Sütun başlıkları ekleyin

İlk satıra (A1'den başlayarak) şunları yazın:

Her hücreye bir tane:

| Hücre | Yazılacak |
|-------|-----------|
| A1 | orderId |
| B1 | customerName |
| C1 | customerEmail |
| D1 | etsyOrderId |
| E1 | productName |
| F1 | status |
| G1 | driveFolderId |
| H1 | analysisJson |
| I1 | concepts |
| J1 | videoUrls |
| K1 | totalCost |
| L1 | notes |

---

## Adım 5.5: Sheets ID'sini not edin

Tarayıcının üstündeki adres çubuğuna bakın.

Şöyle bir şey görürsünüz:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit
```

Ortadaki uzun kısım sizin ID'niz:

```
1AbCdEfGhIjKlMnOp
```

**Bu ID'yi not edin!**

---

## Adım 5.6: Tabloyu paylaşın

Sağ üstte yeşil **Paylaş** butonuna tıklayın.

---

## Adım 5.7: Hizmet hesabını ekleyin

Google Cloud'da oluşturduğunuz hesabın e-postası lazım.

E-posta şuna benzer:

```
rejista-servis@rejista-video-438511.iam.gserviceaccount.com
```

Bunu bulmak için:

1. Google Cloud Console'a gidin
2. IAM & Admin → Service Accounts
3. Hesabınızın e-postasını kopyalayın

---

## Adım 5.8: E-postayı yapıştırın

Paylaşım penceresinde:

E-postayı yapıştırın.

**Düzenleyici** seçin.

**Gönder** tıklayın.

---

# BÖLÜM 6: GOOGLE DRIVE KLASÖRÜ

---

## Adım 6.1: Google Drive'a gidin

Tarayıcınızda şu adrese gidin:

```
drive.google.com
```

---

## Adım 6.2: Yeni klasör oluşturun

Sol tarafta **+ Yeni** butonuna tıklayın.

**Klasör** seçin.

---

## Adım 6.3: Klasöre isim verin

Şunu yazın:

```
Rejista Videolar
```

**Oluştur** tıklayın.

---

## Adım 6.4: Klasörü açın

Oluşturduğunuz klasöre çift tıklayın.

---

## Adım 6.5: Klasör ID'sini not edin

Adres çubuğuna bakın:

```
https://drive.google.com/drive/folders/1XyZaBcDeFgHiJkL
```

Sondaki uzun kısım sizin ID'niz:

```
1XyZaBcDeFgHiJkL
```

**Bu ID'yi not edin!**

---

## Adım 6.6: Klasörü paylaşın

Klasöre sağ tıklayın.

**Paylaş** seçin.

---

## Adım 6.7: Hizmet hesabını ekleyin

Aynı e-postayı yapıştırın:

```
rejista-servis@rejista-video-438511.iam.gserviceaccount.com
```

**Düzenleyici** seçin.

**Gönder** tıklayın.

---

# BÖLÜM 7: GEMİNİ API ANAHTARI

---

## Adım 7.1: AI Studio'ya gidin

Tarayıcınızda şu adrese gidin:

```
aistudio.google.com/app/apikey
```

---

## Adım 7.2: Giriş yapın

Google hesabınızla giriş yapın.

---

## Adım 7.3: API anahtarı oluşturun

**Create API Key** butonuna tıklayın.

---

## Adım 7.4: Proje seçin

Listeden **rejista-video** seçin.

**Create API Key in existing project** tıklayın.

---

## Adım 7.5: Anahtarı kopyalayın

Ekranda uzun bir anahtar görünecek.

Şuna benzer:

```
AIzaSyB1234567890abcdefghijklmnop
```

**Copy** butonuna tıklayın.

**Bu anahtarı not edin!**

**Kimseyle paylaşmayın!**

---

# BÖLÜM 8: AYAR DOSYASINI DÜZENLEME

---

## Adım 8.1: Komut satırını açın

**Windows tuşu + R** basın.

`cmd` yazın.

**Enter** basın.

---

## Adım 8.2: Proje klasörüne gidin

Şunu yazın:

```
cd Desktop\cihaz
```

**Enter** basın.

---

## Adım 8.3: Ayar dosyasını oluşturun

Şunu yazın:

```
copy .env.example .env
```

**Enter** basın.

---

## Adım 8.4: Ayar dosyasını açın

Şunu yazın:

```
notepad .env
```

**Enter** basın.

Notepad açılacak.

---

## Adım 8.5: Değerleri girin

Dosyada şu satırları bulun ve değiştirin:

**Not ettiğiniz değerleri kullanın!**

```
# Google Cloud Proje ID'niz
GOOGLE_CLOUD_PROJECT_ID=rejista-video-438511

# JSON dosyanızın adı (cihaz klasöründeki)
GOOGLE_APPLICATION_CREDENTIALS=./rejista-video-438511-abc123.json

# Gemini API Anahtarınız
GEMINI_API_KEY=AIzaSyB1234567890abcdefghijklmnop

# Google Sheets ID'niz
GOOGLE_SHEETS_ID=1AbCdEfGhIjKlMnOp

# Google Drive Klasör ID'niz
GOOGLE_DRIVE_FOLDER_ID=1XyZaBcDeFgHiJkL

# Gmail adresiniz
GMAIL_USER=sizin-email@gmail.com

# Dashboard şifresi (kendiniz belirleyin)
DASHBOARD_SECRET=benim-gizli-sifrem-123
```

---

## Adım 8.6: Dosyayı kaydedin

Klavyede **Ctrl + S** tuşlarına basın.

Notepad'i kapatın.

---

# BÖLÜM 9: PROGRAMI ÇALIŞTIRMA

---

## Adım 9.1: Komut satırında proje klasöründe olun

Eğer kapatmadıysanız zaten ordasınız.

Kapattıysanız:

```
cd Desktop\cihaz
```

---

## Adım 9.2: Programı başlatın

Şunu yazın:

```
npm start
```

**Enter** basın.

---

## Adım 9.3: Mesajları kontrol edin

Şunları görmelisiniz:

```
✅ Konfigürasyon doğrulaması başarılı
🚀 Rejista başlatılıyor...
📊 Dashboard: http://localhost:8080
```

**Hata görürseniz:** Bölüm 10'a bakın.

---

## Adım 9.4: Dashboard'u açın

Tarayıcınızı açın.

Adres çubuğuna şunu yazın:

```
localhost:8080
```

**Enter** basın.

---

## Adım 9.5: Giriş yapın

API Key kutusuna şifrenizi yazın.

(DASHBOARD_SECRET olarak belirlediğiniz)

---

## Adım 9.6: Test edin

Dashboard'da **Yeni Sipariş** butonuna tıklayın.

Test bilgileri girin:

- Müşteri Adı: Test
- E-posta: test@test.com
- Ürün: Test Ürün

**Oluştur** tıklayın.

Sipariş işleme alınacak!

---

# BÖLÜM 10: SORUN GİDERME

---

## Hata: "node bulunamadı"

Node.js düzgün kurulmamış.

**Çözüm:** Bölüm 1'i tekrarlayın.

---

## Hata: "git bulunamadı"

Git kurulmamış.

**Çözüm:** Bölüm 2'yi tekrarlayın.

---

## Hata: "GOOGLE_APPLICATION_CREDENTIALS"

JSON dosyası bulunamıyor.

**Çözüm:**

1. JSON dosyasının cihaz klasöründe olduğundan emin olun
2. .env dosyasındaki dosya adını kontrol edin
3. Dosya adında hata varsa düzeltin

---

## Hata: "Permission denied"

Paylaşım yapılmamış.

**Çözüm:**

1. Google Sheets'i hizmet hesabıyla paylaştınız mı?
2. Google Drive klasörünü paylaştınız mı?
3. E-posta adresini doğru yazdınız mı?

---

## Hata: "Invalid API key"

Gemini anahtarı yanlış.

**Çözüm:**

1. Anahtarı tekrar kopyalayın
2. Başında veya sonunda boşluk olmadığından emin olun
3. .env dosyasına yapıştırın ve kaydedin

---

## Dashboard açılmıyor

**Çözüm 1:** Program çalışıyor mu kontrol edin.

**Çözüm 2:** Şunu deneyin:

```
127.0.0.1:8080
```

---

## Program dondu

**Çözüm:**

1. **Ctrl + C** tuşlarına basın (durdurmak için)
2. `npm start` yazın (tekrar başlatmak için)

---

# 🎉 TEBRİKLER!

Kurulumu tamamladınız!

Program artık Etsy siparişleriniz için otomatik video üretecek.

---

# 📞 YARDIM

Sorun yaşarsanız:

1. Bu rehberdeki **Bölüm 10**'a bakın
2. Adımları baştan kontrol edin
3. GitHub'da Issue açın

---

# 📝 NOT EDİLECEKLER LİSTESİ

Kurulum sırasında not etmeniz gerekenler:

| Ne | Örnek | Sizinki |
|----|-------|---------|
| Proje ID | rejista-video-438511 | _________ |
| JSON dosya adı | rejista-video-438511-abc.json | _________ |
| Gemini API Key | AIzaSyB123... | _________ |
| Sheets ID | 1AbCdEfGh... | _________ |
| Drive Klasör ID | 1XyZaBcD... | _________ |
| Hizmet hesabı e-posta | rejista-servis@...iam... | _________ |
| Dashboard şifresi | (kendiniz belirleyin) | _________ |
