ARG BUILD_FROM

# Stage 1: Install dependencies on native x86 (avoids QEMU npm crash)
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps

WORKDIR /app

ARG BUILD_VERSION

# Clone and install deps natively (no QEMU emulation needed)
RUN apk add --no-cache git \
    && git clone --depth 1 --branch main \
       https://github.com/akustikrausch/series-complete-for-plex.git . \
    && rm -rf .git .github series-complete-plex/ \
    && rm -f config.default.json \
    && npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

# Stage 2: Target architecture runtime
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs wget

WORKDIR /app

# Copy pre-built app from native stage
COPY --from=deps /app /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=256"

HEALTHCHECK --interval=60s --timeout=5s --start-period=45s --retries=3 \
    CMD wget -q --spider http://localhost:3000/ || exit 1

# Bypass S6 overlay - run Node.js directly as PID 1
ENTRYPOINT []
CMD ["node", "server-crossplatform.js"]
