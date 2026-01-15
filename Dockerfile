# ============================================
# REJISTA - Docker Image
# ============================================

FROM node:20-alpine

# Metadata
LABEL maintainer="Rejista Team"
LABEL description="Rejista - Otonom Video Üretim Ekosistemi"
LABEL version="1.0.0"

# Çalışma dizini
WORKDIR /app

# Sistem bağımlılıkları
RUN apk add --no-cache \
    curl \
    dumb-init

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci --only=production && npm cache clean --force

# Uygulama dosyalarını kopyala
COPY src/ ./src/
COPY apps-script/ ./apps-script/

# Log dizini
RUN mkdir -p logs && chown -R node:node logs

# Non-root user
USER node

# Port
EXPOSE 3000 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/status || exit 1

# dumb-init ile başlat (PID 1 sorunu için)
ENTRYPOINT ["dumb-init", "--"]

# Uygulamayı başlat
CMD ["node", "src/index.js"]
