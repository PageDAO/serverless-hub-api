/**
 * Creates a standardized API response
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code
 * @param {Object} extraHeaders - Additional headers to include
 * @param {boolean} isFrame - Whether this is a Frame request
 * @returns {Object} Netlify function response object
 */
function createResponse(data, statusCode = 200, extraHeaders = {}, isFrame = false) {
  // Default cache duration: 60 seconds
  const cacheDuration = process.env.CACHE_DURATION || 60;
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': `public, max-age=${cacheDuration}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      success: statusCode >= 200 && statusCode < 300,
      data,
      timestamp: Date.now()
    })
  };
}

module.exports = { createResponse };
