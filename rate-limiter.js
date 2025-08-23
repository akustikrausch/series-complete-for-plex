// Rate limiter for API calls
class RateLimiter {
    constructor() {
        this.queues = new Map(); // Separate queue for each API
        this.limits = {
            'tmdb': {
                maxRequests: 30,  // 30 requests
                perSeconds: 10,   // per 10 seconds
                minDelay: 350     // minimum 350ms between requests
            },
            'thetvdb': {
                maxRequests: 100, // 100 requests
                perSeconds: 60,   // per minute
                minDelay: 650     // minimum 650ms between requests
            },
            'openai': {
                maxRequests: 60,  // 60 requests
                perSeconds: 60,   // per minute
                minDelay: 1000    // minimum 1 second between requests
            },
            'default': {
                maxRequests: 10,  // Conservative default
                perSeconds: 10,   
                minDelay: 1000
            }
        };
        this.requests = new Map(); // Track requests per API
    }

    async throttle(apiName, fn) {
        const limit = this.limits[apiName] || this.limits.default;
        
        // Initialize tracking for this API if needed
        if (!this.requests.has(apiName)) {
            this.requests.set(apiName, []);
        }
        
        const now = Date.now();
        const requests = this.requests.get(apiName);
        
        // Remove old requests outside the time window
        const windowStart = now - (limit.perSeconds * 1000);
        const recentRequests = requests.filter(time => time > windowStart);
        
        // Check if we've hit the rate limit
        if (recentRequests.length >= limit.maxRequests) {
            // Calculate how long to wait
            const oldestRequest = recentRequests[0];
            const waitTime = (oldestRequest + (limit.perSeconds * 1000)) - now + 100; // Add 100ms buffer
            
            console.log(`Rate limit reached for ${apiName}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Recursive call after waiting
            return this.throttle(apiName, fn);
        }
        
        // Check minimum delay between requests
        if (recentRequests.length > 0) {
            const lastRequest = recentRequests[recentRequests.length - 1];
            const timeSinceLastRequest = now - lastRequest;
            
            if (timeSinceLastRequest < limit.minDelay) {
                const waitTime = limit.minDelay - timeSinceLastRequest + 10; // Add 10ms buffer
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // Track this request
        recentRequests.push(Date.now());
        this.requests.set(apiName, recentRequests);
        
        // Execute the function
        try {
            return await fn();
        } catch (error) {
            // On error, wait extra time before next request
            await new Promise(resolve => setTimeout(resolve, limit.minDelay * 2));
            throw error;
        }
    }
    
    getStats() {
        const stats = {};
        for (const [api, requests] of this.requests.entries()) {
            const now = Date.now();
            const limit = this.limits[api] || this.limits.default;
            const windowStart = now - (limit.perSeconds * 1000);
            const recentRequests = requests.filter(time => time > windowStart);
            
            stats[api] = {
                recent: recentRequests.length,
                limit: limit.maxRequests,
                window: `${limit.perSeconds}s`
            };
        }
        return stats;
    }
    
    reset(apiName) {
        if (apiName) {
            this.requests.delete(apiName);
        } else {
            this.requests.clear();
        }
    }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;