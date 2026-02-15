#!/usr/bin/with-contenv bashio

export NODE_ENV=production
export PORT=3000
export NODE_OPTIONS="--max-old-space-size=256"

# Validate required configuration
if ! bashio::config.has_value 'plex_url'; then
    bashio::log.warning "Plex URL is not configured. Please set it in the addon configuration."
fi
if ! bashio::config.has_value 'plex_token'; then
    bashio::log.warning "Plex Token is not configured. Please set it in the addon configuration."
fi

cd /app
bashio::log.info "Starting Series Complete for Plex v2.6.2..."
exec node server-crossplatform.js
