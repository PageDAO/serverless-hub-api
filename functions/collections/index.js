const { rateLimitCheck } = require('../utils/rateLimiter');
const { createResponse } = require('../utils/responseFormatter');
const { handleError } = require('../utils/errorHandler');
const { isFrameRequest, optimizeForFrame } = require('../utils/frameDetection');
const { ContentTrackerFactory } = require('@pagedao/core');

exports.handler = async function(event) {
  try {
    // Check rate limiting
    const rateLimitResponse = await rateLimitCheck(event);
    if (rateLimitResponse) return rateLimitResponse;
    
    // Detect if request is from a Frame
    const isFrame = isFrameRequest(event);
    
    // Parse path and query parameters
    const path = event.path.replace(/^\/\.netlify\/functions\/collections\/?/, '').split('/');
    const collectionAddress = path[0] || '';
    const subResource = path[1] || '';
    const queryParams = event.queryStringParameters || {};
    
    // Set default values for pagination and filtering
    const limit = parseInt(queryParams.limit) || 20;
    const offset = parseInt(queryParams.offset) || 0;
    const chain = queryParams.chain || 'all';
    
    let response;
    
    // Route based on path
    if (!collectionAddress) {
      // GET /collections
      const collections = await getCollectionsList(chain, limit, offset);
      response = createResponse(collections, 200, {}, isFrame);
    } else if (subResource === 'items') {
      // GET /collections/:address/items
      const items = await getCollectionItems(collectionAddress, chain, limit, offset);
      response = createResponse(items, 200, {}, isFrame);
    } else {
      // GET /collections/:address
      const collection = await getCollectionDetails(collectionAddress, chain);
      if (!collection) {
        throw { code: 'NOT_FOUND', message: 'Collection not found' };
      }
      response = createResponse(collection, 200, {}, isFrame);
    }
    
    // Optimize for Frame if necessary
    return optimizeForFrame(response, isFrame);
  } catch (error) {
    return handleError(error, isFrameRequest(event));
  }
};

/**
 * Get a list of collections
 * @param {string} chain - Blockchain to filter by, or 'all'
 * @param {number} limit - Number of collections to return
 * @param {number} offset - Pagination offset
 */
async function getCollectionsList() {
  try {
    const { ContentTrackerFactory } = require('@pagedao/core');
    
    // Get all registered content types
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    
    // Supported chains
    const supportedChains = ['base', 'ethereum', 'optimism', 'zora', 'polygon'];
    
    // Array to collect all collections
    const allCollections = [];
    
    // Loop through chains and content types
    for (const chain of supportedChains) {
      for (const contentType of contentTypes) {
        try {
          // Get contract address from environment or config
          const contractAddress = process.env[`${chain.toUpperCase()}_${contentType.toUpperCase()}_CONTRACT`] || '';
          if (!contractAddress) continue;
          
          const tracker = ContentTrackerFactory.getTracker(contractAddress, contentType, chain);
          
          // Get collections - depending on your API, you might need to call a different method
          if (tracker.getCollections) {
            const collections = await tracker.getCollections();
            allCollections.push(...collections);
          }
        } catch (error) {
          console.warn(`Error getting collections for ${chain}/${contentType}: ${error.message}`);
        }
      }
    }
    
    return allCollections;
  } catch (error) {
    console.error('Error fetching collections list:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific collection
 * @param {string} address - The collection address
 * @param {string} chain - The blockchain to search on, or 'all'
 */
async function getCollectionDetails(address, chain) {
  try {
    const factory = new ContentTrackerFactory();
    
    if (chain && chain !== 'all') {
      // If chain is specified, only look there
      const adapter = await factory.getContentTrackerForChain(chain);
      if (!adapter) {
        throw { code: 'INVALID_PARAM', message: `Invalid chain: ${chain}` };
      }
      return await adapter.getCollectionByAddress(address);
    } else {
      // Search across all chains
      const adapters = await factory.getAllContentTrackers();
      
      for (const adapter of adapters) {
        try {
          const collection = await adapter.getCollectionByAddress(address);
          if (collection) return collection;
        } catch (e) {
          // Continue to next adapter if not found
        }
      }
    }
    
    // If we get here, the collection wasn't found
    return null;
  } catch (error) {
    console.error('Error fetching collection details:', error);
    throw error;
  }
}

/**
 * Get items in a collection
 * @param {string} address - The collection address
 * @param {string} chain - The blockchain to search on
 * @param {number} limit - Number of items to return
 * @param {number} offset - Pagination offset
 */
async function getCollectionItems(address, chain, limit, offset) {
  try {
    const factory = new ContentTrackerFactory();
    
    // First, determine which chain this collection is on if not specified
    if (!chain || chain === 'all') {
      const adapters = await factory.getAllContentTrackers();
      
      for (const adapter of adapters) {
        try {
          const collection = await adapter.getCollectionByAddress(address);
          if (collection) {
            chain = collection.chain;
            break;
          }
        } catch (e) {
          // Continue to next adapter
        }
      }
      
      if (!chain || chain === 'all') {
        throw { code: 'NOT_FOUND', message: 'Collection not found on any chain' };
      }
    }
    
    // Now get the items using the appropriate adapter
    const adapter = await factory.getContentTrackerForChain(chain);
    if (!adapter) {
      throw { code: 'INVALID_PARAM', message: `Invalid chain: ${chain}` };
    }
    
    const items = await adapter.getCollectionItems(address, limit, offset);
    
    return {
      items,
      pagination: {
        total: items.length, // This would ideally be the total count from the source
        limit,
        offset,
        hasMore: items.length === limit // Assumes if we got 'limit' items, there might be more
      },
      collection: {
        address,
        chain
      }
    };
  } catch (error) {
    console.error('Error fetching collection items:', error);
    throw error;
  }
}
