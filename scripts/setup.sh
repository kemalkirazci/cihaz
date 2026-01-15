#!/bin/bash

# ============================================
# REJISTA - Kurulum Scripti
# ============================================

set -e

echo "🎬 Rejista Kurulum Scripti"
echo "=========================="
echo ""

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonksiyonlar
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 mevcut"
        return 0
    else
        echo -e "${RED}✗${NC} $1 bulunamadı"
        return 1
    fi
}

# Node.js kontrolü
echo "📋 Önkoşullar kontrol ediliyor..."
echo ""

if ! check_command node; then
    echo -e "${YELLOW}Node.js kurulumu gerekli. https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Node.js 20+ gerekli. Mevcut: $(node -v)${NC}"
    exit 1
fi

check_command npm
check_command git

echo ""
echo "📦 Bağımlılıklar yükleniyor..."
npm install

echo ""
echo "📁 Dizin yapısı oluşturuluyor..."
mkdir -p logs
mkdir -p credentials

echo ""
echo "⚙️ Ortam dosyası kontrol ediliyor..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  .env dosyası oluşturuldu. Lütfen değerleri doldurun!${NC}"
else
    echo -e "${GREEN}✓${NC} .env dosyası mevcut"
fi

echo ""
echo "🔑 Credentials kontrolü..."
if [ ! -f credentials/service-account.json ]; then
    echo -e "${YELLOW}⚠️  Google Service Account key'i eksik!${NC}"
    echo "   credentials/service-account.json dosyasını ekleyin."
else
    echo -e "${GREEN}✓${NC} Service account key mevcut"
fi

echo ""
echo "============================================"
echo -e "${GREEN}✓ Kurulum tamamlandı!${NC}"
echo ""
echo "Sonraki adımlar:"
echo "1. .env dosyasını düzenleyin"
echo "2. Google Cloud credentials'ı ekleyin"
echo "3. npm start ile sistemi başlatın"
echo ""
echo "Dashboard: http://localhost:8080"
echo "============================================"
