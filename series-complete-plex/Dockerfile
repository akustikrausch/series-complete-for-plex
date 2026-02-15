ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js and git
RUN apk add --no-cache nodejs npm git wget

# Set working directory
WORKDIR /app

# Clone application from public repository (specific version tag)
ARG APP_VERSION=2.6.0
RUN git clone --depth 1 --branch main \
    https://github.com/akustikrausch/series-complete-for-plex.git . \
    && rm -rf .git .github series-complete-plex/

# Install production dependencies only, skip native builds (sqlite3 not needed)
RUN npm ci --omit=dev --ignore-scripts --no-optional

# Copy run script from build context (addon directory)
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/test-connection || exit 1

CMD [ "/run.sh" ]
