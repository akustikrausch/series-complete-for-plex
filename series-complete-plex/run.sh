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

# Send discovery info to Home Assistant so the integration can auto-detect this app
send_discovery() {
    local retries=0
    local max_retries=10
    # Wait for the web server to be ready
    while [ $retries -lt $max_retries ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/test-connection 2>/dev/null | grep -q "200"; then
            bashio::log.info "Web server is ready, sending discovery to Home Assistant..."
            curl -s -X POST \
                -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
                -H "Content-Type: application/json" \
                -d "{\"service\":\"series_complete\",\"config\":{\"host\":\"$(hostname)\",\"port\":3000}}" \
                http://supervisor/discovery 2>/dev/null && \
                bashio::log.info "Discovery sent successfully" || \
                bashio::log.warning "Discovery send failed (integration may not be installed yet)"
            return
        fi
        retries=$((retries + 1))
        sleep 2
    done
    bashio::log.warning "Web server did not start within ${max_retries} attempts, skipping discovery"
}

# Send discovery in background so it doesn't block startup
send_discovery &

bashio::log.info "Starting Series Complete for Plex v2.6.7..."
exec node server-crossplatform.js
