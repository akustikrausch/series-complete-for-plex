ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install runtime and build dependencies
RUN apk add --no-cache nodejs npm wget \
    && apk add --no-cache --virtual .build-deps git

WORKDIR /app

# Clone application from public repository
RUN git clone --depth 1 --branch main \
    https://github.com/akustikrausch/series-complete-for-plex.git . \
    && rm -rf .git .github series-complete-plex/

# Install production dependencies, skip native builds
RUN npm ci --omit=dev --ignore-scripts --no-optional \
    && npm cache clean --force

# Remove build dependencies
RUN apk del .build-deps

# Copy run script from build context (addon directory)
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Health check - lightweight root page check (no Plex connection needed)
HEALTHCHECK --interval=60s --timeout=5s --start-period=45s --retries=3 \
    CMD wget -q --spider http://localhost:3000/ || exit 1

CMD [ "/run.sh" ]
