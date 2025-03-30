const { rateLimitCheck } = require('../utils/rateLimiter');
const { createResponse } = require('../utils/responseFormatter');
const { handleError } = require('../utils/errorHandler');
const { isFrameRequest, optimizeForFrame } = require('../utils/frameDetection');
const { initializeContentAdapters, ContentTrackerFactory } = require('@pagedao/core');

exports.handler = async function(event) {
  try {
    // Initialize content adapters
    initializeContentAdapters();
    
    // Check rate limiting
    const rateLimitResponse = await rateLimitCheck(event);
    if (rateLimitResponse) return rateLimitResponse;
    
    // Detect if request is from a Frame
    const isFrame = isFrameRequest(event);
    
    // Parse path parameters
    const path = event.path.replace(/^\/\.netlify\/functions\/blockchain\/?/, '').split('/');
    const queryParams = event.queryStringParameters || {};
    
    // Expected path format: /{chain}/{address}/[{method}/[{param1}/{param2}/...]]
    if (path.length < 2) {
      throw { code: 'INVALID_PATH', message: 'Invalid path format. Expected /{chain}/{address}/[{method}/[{params}]]' };
    }
    
    const chain = path[0];
    const address = path[1];
    const method = path[2] || 'info'; // Default method is 'info'
    const params = path.slice(3);
    
    // Get content type from query parameter
    const contentType = queryParams.type || '';
    
    // Validate required parameters
    if (!chain) throw { code: 'MISSING_PARAM', message: 'Chain is required' };
    if (!address) throw { code: 'MISSING_PARAM', message: 'Contract address is required' };
    
    // Process the request
    const data = await processBlockchainRequest(chain, address, method, params, contentType);
    const response = createResponse(data, 200, {}, isFrame);
    
    return optimizeForFrame(response, isFrame);
  } catch (error) {
    return handleError(error, isFrameRequest(event));
  }
};

/**
 * Process a blockchain data request
 */
async function processBlockchainRequest(chain, address, method, params, contentTypeHint) {
  console.log(`Processing blockchain request: ${chain}/${address}/${method}`);
  
  // Try to create a content tracker
  let tracker;
  
  // If content type is provided, try it first
  if (contentTypeHint) {
    try {
      tracker = ContentTrackerFactory.getTracker(address, contentTypeHint, chain);
    } catch (error) {
      console.warn(`Failed to create tracker with provided type ${contentTypeHint}: ${error.message}`);
      // Continue and try other types
    }
  }
  
  // If not created yet, try all registered types
  if (!tracker) {
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    
    for (const type of contentTypes) {
      try {
        tracker = ContentTrackerFactory.getTracker(address, type, chain);
        // Test if tracker works by getting basic info
        await tracker.getCollectionInfo();
        console.log(`Successfully created tracker using type: ${type}`);
        break; // Exit loop when found working tracker
      } catch (error) {
        console.warn(`Failed with type ${type}: ${error.message}`);
        // Continue trying other types
      }
    }
  }
  
  if (!tracker) {
    throw { code: 'CONTRACT_ERROR', message: 'Could not create tracker for this contract' };
  }
  
  // Process the request based on method
  switch (method) {
    case 'info':
      return {
        ...(await tracker.getCollectionInfo()),
        address,
        chain,
        type: tracker.getContentType()
      };
      
    case 'metadata':
      if (params.length < 1) {
        throw { code: 'MISSING_PARAM', message: 'Token ID is required for metadata' };
      }
      return await tracker.fetchMetadata(params[0]);
      
    case 'tokens':
      const options = { maxTokens: 100 };
      if (params[0]) options.maxTokens = parseInt(params[0]);
      return await tracker.getAllTokens(options);
      
    case 'ownership':
      if (params.length < 1) {
        throw { code: 'MISSING_PARAM', message: 'Token ID is required for ownership' };
      }
      return await tracker.fetchOwnership(params[0]);
      
    case 'rights':
      if (params.length < 1) {
        throw { code: 'MISSING_PARAM', message: 'Token ID is required for rights' };
      }
      return await tracker.fetchRights(params[0]);
      
    case 'ownerTokens':
      if (params.length < 1) {
        throw { code: 'MISSING_PARAM', message: 'Owner address is required' };
      }
      return await tracker.getTokensByOwner(params[0]);
      
    default:
      throw { code: 'INVALID_METHOD', message: `Unknown method: ${method}` };
  }
}