// Base Path Detection for Home Assistant Ingress
// Must be loaded FIRST before any other scripts
(function() {
    'use strict';

    // Read ingress path from meta tag (injected server-side in HA mode)
    const meta = document.querySelector('meta[name="ingress-path"]');
    const basePath = (meta && meta.content) ? meta.content.replace(/\/+$/, '') : '';

    // Export globally
    window.API_BASE = basePath;

    if (basePath) {
        console.log('[BasePath] Ingress path detected:', basePath);

        // Monkey-patch fetch to prepend base path for API calls
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string') {
                if (input.startsWith('/api/') || input.startsWith('/ws')) {
                    input = basePath + input;
                }
            } else if (input instanceof Request) {
                const url = new URL(input.url);
                if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
                    const newUrl = url.origin + basePath + url.pathname + url.search;
                    input = new Request(newUrl, input);
                }
            }
            return originalFetch.call(this, input, init);
        };
    }
})();
