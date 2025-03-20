const { RateLimiterMemory } = require('rate-limiter-flexible');

// Create a rate limiter with these settings:
// - 120 requests per minute per IP (2 requests per second)
// - This is generous for normal usage but prevents abuse
// - In-memory storage (will reset when functions cold start)
const rateLimiter = new RateLimiterMemory({
  points: 120,        // Number of points
  duration: 60,       // Per 60 seconds
  blockDuration: 60,  // Block for 1 minute if exceeded
});

/**
 * Rate limiting middleware for Netlify Functions
 * @param {Object} event - Netlify Function event
 * @returns {Object|null} - Rate limit error response or null if not rate limited
 */
async function rateLimitCheck(event) {
  try {
    // Get client IP
    const clientIP = event.headers['client-ip'] || 
                    event.headers['x-forwarded-for'] || 
                    'unknown';
    
    // Check rate limit
    await rateLimiter.consume(clientIP);
    return null; // Not rate limited
  } catch (error) {
    // Rate limit exceeded
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Retry-After': Math.ceil(error.msBeforeNext / 1000) || 60
      },
      body: JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000) || 60
      })
    };
  }
}

module.exports = { rateLimitCheck };