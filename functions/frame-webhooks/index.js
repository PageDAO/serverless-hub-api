const { rateLimitCheck } = require('../utils/rateLimiter');
const { createResponse } = require('../utils/responseFormatter');
const { handleError } = require('../utils/errorHandler');

exports.handler = async function(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'POST',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Method not allowed'
        }
      })
    };
  }
  
  try {
    // Check rate limiting
    const rateLimitResponse = await rateLimitCheck(event);
    if (rateLimitResponse) return rateLimitResponse;
    
    // Parse request body
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      throw { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body' };
    }
    
    // Validate the payload has required fields
    if (!payload.frameAction || !payload.trustedData || !payload.trustedData.messageBytes) {
      throw { 
        code: 'INVALID_PAYLOAD', 
        message: 'Missing required fields in Frame payload' 
      };
    }
    
    // Process based on frame action type
    switch (payload.frameAction) {
      case 'buttonClick':
        return await handleButtonClick(payload);
      case 'textInput':
        return await handleTextInput(payload);
      case 'urlUpload':
        return await handleUrlUpload(payload);
      default:
        throw { 
          code: 'UNSUPPORTED_ACTION', 
          message: `Unsupported frame action: ${payload.frameAction}` 
        };
    }
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Handle button click events from frames
 * @param {Object} payload - The webhook payload
 */
async function handleButtonClick(payload) {
  console.log('Frame button click received:', payload.frameAction);
  
  // Extract information from the payload
  const buttonIndex = payload.buttonIndex;
  const fid = payload.trustedData.fid;
  const frameUrl = payload.frameUrl;
  
  // Log the interaction for analytics
  console.log(`User ${fid} clicked button ${buttonIndex} on frame ${frameUrl}`);
  
  // Here you would typically:
  // 1. Store the interaction in your database
  // 2. Process any business logic based on the button click
  // 3. Return a response that might update the frame
  
  // For now, we'll just acknowledge receipt
  return createResponse({
    message: 'Button click processed successfully',
    action: 'buttonClick',
    buttonIndex,
    timestamp: Date.now()
  });
}

/**
 * Handle text input events from frames
 * @param {Object} payload - The webhook payload
 */
async function handleTextInput(payload) {
  console.log('Frame text input received:', payload.frameAction);
  
  // Extract information from the payload
  const inputText = payload.inputText;
  const fid = payload.trustedData.fid;
  const frameUrl = payload.frameUrl;
  
  // Log the interaction for analytics
  console.log(`User ${fid} submitted text "${inputText}" on frame ${frameUrl}`);
  
  // Process the text input
  // This would typically involve business logic specific to your application
  
  return createResponse({
    message: 'Text input processed successfully',
    action: 'textInput',
    timestamp: Date.now()
  });
}

/**
 * Handle URL upload events from frames
 * @param {Object} payload - The webhook payload
 */
async function handleUrlUpload(payload) {
  console.log('Frame URL upload received:', payload.frameAction);
  
  // Extract information from the payload
  const imageUrl = payload.imageUrl;
  const fid = payload.trustedData.fid;
  const frameUrl = payload.frameUrl;
  
  // Log the interaction for analytics
  console.log(`User ${fid} uploaded URL "${imageUrl}" on frame ${frameUrl}`);
  
  // Process the URL upload
  // This would typically involve validating and processing the uploaded URL
  
  return createResponse({
    message: 'URL upload processed successfully',
    action: 'urlUpload',
    timestamp: Date.now()
  });
}
