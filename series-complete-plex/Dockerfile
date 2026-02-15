ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only, skip native builds (sqlite3 not needed in API mode)
RUN npm ci --omit=dev --ignore-scripts

# Copy application code
COPY . .

# Copy run script
COPY series-complete-plex/run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
