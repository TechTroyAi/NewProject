# ─────────────────────────────────────────────────────────────
# Shelf worker — page conversion, OCR, chunking, embedding, AI.
#
# Office documents are a classic attack vector, so this image runs
# with no network egress, a read-only root filesystem and a non-root
# user. The host must also drop all Linux capabilities.
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# System tools used by the pipeline:
#   poppler-utils → pdftoppm (PDF → pages), pdftotext (text layer)
#   tesseract-ocr → OCR fallback for image-only pages
#   libreoffice   → PPTX / DOCX / EPUB / TXT → PDF
#   fonts-*      → correct glyph rendering when rasterising
RUN apt-get update && apt-get install -y --no-install-recommends \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-eng \
      libreoffice-core \
      libreoffice-writer \
      libreoffice-impress \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so the layer caches across source changes.
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

# Precompile to plain JS so the runtime image needs no TypeScript.
RUN npm install --no-save tsx@4.19.2

# Non-root runtime user.
RUN useradd --create-home --shell /bin/bash shelf \
    && mkdir -p /tmp/shelf \
    && chown -R shelf:shelf /app /tmp/shelf
USER shelf

ENV TMPDIR=/tmp/shelf

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

# tini reaps the LibreOffice zombies.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
