/**
 * Detects if a request is coming from a Farcaster Frame
 * @param {Object} event - Netlify function event
 * @returns {boolean} True if request is from a Frame
 */
function isFrameRequest(event) {
  if (!event || !event.headers) return false;
  
  const userAgent = event.headers['user-agent'] || '';
  const fcFrame = event.headers['fc-frame'] || '';
  
  return userAgent.includes('Farcaster') || 
         fcFrame === 'true' ||
         event.queryStringParameters?.frame === 'true';
}

/**
 * Adds Frame-specific optimizations to response if needed
 * @param {Object} response - API response object
 * @param {boolean} isFrame - Whether this is a Frame request
 * @returns {Object} Potentially modified response
 */
function optimizeForFrame(response, isFrame) {
  if (!isFrame) return response;
  
  // Add Frame-specific headers if needed
  const headers = {
    ...response.headers,
    'X-Frame-Optimized': 'true'
  };
  
  // Parse the response body
  const body = JSON.parse(response.body);
  
  // Optimize the body for Frame context if needed
  // This could include limiting data size, formatting, etc.
  
  return {
    ...response,
    headers,
    body: JSON.stringify(body)
  };
}

module.exports = { isFrameRequest, optimizeForFrame };
