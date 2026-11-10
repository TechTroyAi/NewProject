# ─────────────────────────────────────────────────────────────
# Shelf worker — page conversion, OCR, chunking, embedding, AI.
#
# Office documents are a classic attack vector, so this image runs
# with no network egress, a read-only root filesystem and a non-root
# user. The host must also drop all Linux capabilities.
#
# Build from the repository root, because the worker imports two
# packages that live in it:
#   docker build -t shelf-worker -f apps/worker/Dockerfile .
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

# The local packages and the worker's manifest first, so the install
# layer is cached across source changes.
COPY packages/shared/package.json packages/shared/package.json
COPY packages/sources/package.json packages/sources/package.json
COPY apps/worker/package.json apps/worker/package.json

# `@shelf/shared` and `@shelf/sources` are workspace packages, not
# registry packages. Point them at the copies in the image before
# installing, or npm would go looking for them on the registry.
RUN node -e "\
const fs = require('fs');\
const path = 'apps/worker/package.json';\
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));\
pkg.dependencies['@shelf/shared'] = 'file:../../packages/shared';\
pkg.dependencies['@shelf/sources'] = 'file:../../packages/sources';\
fs.writeFileSync(path, JSON.stringify(pkg, null, 2));\
" \
 && cd apps/worker \
 && npm install --omit=dev --ignore-scripts \
 && npm cache clean --force

COPY packages/shared packages/shared
COPY packages/sources packages/sources
COPY apps/worker/tsconfig.json apps/worker/tsconfig.json
COPY apps/worker/src apps/worker/src

# Precompile to plain JS so the runtime image needs no TypeScript.
RUN cd apps/worker && npm install --no-save tsx@4.19.2

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
