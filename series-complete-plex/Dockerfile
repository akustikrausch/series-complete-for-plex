ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files from repo root (build context is repo root via build.yaml)
COPY package.json package-lock.json ./

# Install production dependencies only, skip native builds (sqlite3 not needed in API mode)
RUN npm ci --omit=dev --ignore-scripts --no-optional

# Copy application code (excluding addon dir itself)
COPY config.json ./
COPY server-crossplatform.js server-secure.js tv-api-service.js ./
COPY services/ ./services/
COPY middleware/ ./middleware/
COPY utils/ ./utils/
COPY src/ ./src/
COPY public/ ./public/

# Copy run script
COPY series-complete-plex/run.sh /run.sh
RUN chmod a+x /run.sh

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/test-connection || exit 1

CMD [ "/run.sh" ]
