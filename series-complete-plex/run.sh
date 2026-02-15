#!/usr/bin/with-contenv bashio

export NODE_ENV=production
export PORT=3000

cd /app

bashio::log.info "Starting Series Complete for Plex..."

exec node server-crossplatform.js
