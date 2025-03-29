/**
 * Handles API errors with standardized responses
 * @param {Error} error - The error that occurred
 * @param {boolean} isFrame - Whether this is a Frame request
 * @returns {Object} Netlify function error response
 */
function handleError(error, isFrame = false) {
  console.error('API Error:', error);
  
  let statusCode = 500;
  let errorMessage = 'An internal server error occurred';
  
  // Determine appropriate status code and message
  if (error.code === 'NOT_FOUND') {
    statusCode = 404;
    errorMessage = 'Resource not found';
  } else if (error.code === 'INVALID_PARAM') {
    statusCode = 400;
    errorMessage = 'Invalid request parameters';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    errorMessage = error.message;
  }
  
  // Simplified error for Frame context
  const errorDetails = isFrame 
    ? { message: errorMessage }
    : { 
        message: errorMessage,
        code: error.code || 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      success: false,
      error: errorDetails,
      timestamp: Date.now()
    })
  };
}

module.exports = { handleError };
