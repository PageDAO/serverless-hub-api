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
    
    // Parse path and query parameters
    const path = event.path.replace(/^\/\.netlify\/functions\/collections\/?/, '').split('/');
    const collectionAddress = path[0] || '';
    const subResource = path[1] || '';
    const queryParams = event.queryStringParameters || {};
    
    // Set default values for pagination and filtering
    const limit = parseInt(queryParams.limit) || 20;
    const offset = parseInt(queryParams.offset) || 0;
    
    let response;
    
    // Route based on path
    if (!collectionAddress) {
      // GET /collections - List collections from query params
      if (!queryParams.addresses) {
        throw { code: 'MISSING_PARAM', message: 'Collection addresses are required' };
      }
      
      const addresses = queryParams.addresses.split(',');
      const chainsByAddress = {};
      
      // Parse chains if provided
      if (queryParams.chains) {
        const chains = queryParams.chains.split(',');
        addresses.forEach((addr, index) => {
          chainsByAddress[addr] = chains[index] || chains[0] || 'ethereum';
        });
      } else {
        // Default all to same chain
        addresses.forEach(addr => {
          chainsByAddress[addr] = queryParams.chain || 'ethereum';
        });
      }
      
      const types = queryParams.types ? queryParams.types.split(',') : [];
      const typesByAddress = {};
      if (types.length > 0) {
        addresses.forEach((addr, index) => {
          typesByAddress[addr] = types[index] || types[0] || '';
        });
      }
      
      const collections = await getCollectionsList(addresses, chainsByAddress, typesByAddress, limit, offset);
      response = createResponse(collections, 200, {}, isFrame);
    } else if (subResource === 'items') {
      // GET /collections/:address/items
      if (!queryParams.chain) {
        throw { code: 'MISSING_PARAM', message: 'Chain parameter is required' };
      }
      
      const contentType = queryParams.type || '';
      const items = await getCollectionItems(collectionAddress, queryParams.chain, contentType, limit, offset);
      response = createResponse(items, 200, {}, isFrame);
    } else {
      // GET /collections/:address
      if (!queryParams.chain) {
        throw { code: 'MISSING_PARAM', message: 'Chain parameter is required' };
      }
      
      const contentType = queryParams.type || '';
      const collection = await getCollectionDetails(collectionAddress, queryParams.chain, contentType);
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
 * @param {string[]} addresses - Collection addresses
 * @param {Object} chainsByAddress - Map of address to chain
 * @param {Object} typesByAddress - Map of address to content type hint
 * @param {number} limit - Number of collections to return
 * @param {number} offset - Pagination offset
 */
async function getCollectionsList(addresses, chainsByAddress, typesByAddress, limit, offset) {
  try {
    console.log(`Fetching collections for ${addresses.length} addresses`);
    
    // Array to collect all collections with metadata
    const allCollections = [];
    
    // Process each address
    for (const address of addresses) {
      try {
        const chain = chainsByAddress[address];
        const typeHint = typesByAddress[address] || '';
        console.log(`Processing ${address} on ${chain} with type hint: ${typeHint}`);
        
        // Try to get collection details
        try {
          const collectionInfo = await getCollectionDetails(address, chain, typeHint);
          if (collectionInfo) {
            allCollections.push(collectionInfo);
          }
        } catch (error) {
          console.warn(`Error fetching collection ${address} on ${chain}: ${error.message}`);
          // Add minimal info for failed collections
          allCollections.push({
            address,
            chain,
            error: error.message,
            _fetchFailed: true
          });
        }
      } catch (error) {
        console.error(`Error processing address ${address}:`, error.message);
      }
    }
    
    // Sort collections alphabetically by name
    allCollections.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    console.log(`Returning ${allCollections.length} collections`);
    
    // Apply pagination
    return {
      items: allCollections.slice(offset, offset + limit),
      pagination: {
        total: allCollections.length,
        limit,
        offset,
        hasMore: allCollections.length > offset + limit
      }
    };
  } catch (error) {
    console.error('Error fetching collections list:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific collection
 * @param {string} address - The collection address
 * @param {string} chain - The blockchain chain
 * @param {string} contentTypeHint - Optional content type hint
 */
async function getCollectionDetails(address, chain, contentTypeHint) {
  try {
    console.log(`Fetching collection details for ${address} on ${chain}`);
    
    // Check if ContentTrackerFactory has registered types
    const registeredTypes = ContentTrackerFactory.getRegisteredTypes();
    console.log(`Registered content types: ${JSON.stringify(registeredTypes)}`);
    
    // Try to create a content tracker
    let tracker;
    let successful = false;
    let usedType = '';
    
    // If content type is provided, try it first
    if (contentTypeHint) {
      try {
        console.log(`Trying with provided type hint: ${contentTypeHint}`);
        tracker = ContentTrackerFactory.getTracker(address, contentTypeHint, chain);
        // Test if it works
        await tracker.getCollectionInfo();
        console.log(`Successfully created tracker using hint type: ${contentTypeHint}`);
        successful = true;
        usedType = contentTypeHint;
      } catch (error) {
        console.warn(`Failed with provided type ${contentTypeHint}: ${error.message}`);
      }
    }
    
    // If not successful yet, try all registered types
    if (!successful) {
      for (const type of registeredTypes) {
        try {
          console.log(`Trying with content type: ${type}`);
          tracker = ContentTrackerFactory.getTracker(address, type, chain);
          // Test if it works by getting collection info
          await tracker.getCollectionInfo();
          console.log(`Successfully created tracker using type: ${type}`);
          successful = true;
          usedType = type;
          break;
        } catch (error) {
          console.warn(`Failed with type ${type}: ${error.message}`);
        }
      }
    }
    
    // If still not successful, try some hardcoded common types
    if (!successful) {
      const fallbackTypes = ['book', 'publication', 'nft', 'alexandria_book', 'mirror_publication', 'zora_nft'];
      for (const type of fallbackTypes) {
        if (!registeredTypes.includes(type)) {
          try {
            console.log(`Trying fallback type: ${type}`);
            tracker = ContentTrackerFactory.getTracker(address, type, chain);
            // Test if it works
            await tracker.getCollectionInfo();
            console.log(`Successfully created tracker using fallback type: ${type}`);
            successful = true;
            usedType = type;
            break;
          } catch (error) {
            console.warn(`Failed with fallback type ${type}: ${error.message}`);
          }
        }
      }
    }
    
    if (!successful) {
      console.log(`No compatible tracker found for ${address}`);
      return null;
    }
    
    // Get collection info
    const collectionInfo = await tracker.getCollectionInfo();
    
    // Add chain and address info
    return {
      ...collectionInfo,
      address,
      chain,
      type: usedType
    };
  } catch (error) {
    console.error(`Error fetching collection details for ${address}:`, error);
    throw error;
  }
}

/**
 * Get items in a collection
 * @param {string} address - The collection address
 * @param {string} chain - The blockchain chain
 * @param {string} contentTypeHint - Optional content type hint
 * @param {number} limit - Number of items to return
 * @param {number} offset - Pagination offset
 */
async function getCollectionItems(address, chain, contentTypeHint, limit, offset) {
  try {
    console.log(`Fetching items for ${address} on ${chain}`);
    
    // Get collection details to determine the right tracker type
    const collectionInfo = await getCollectionDetails(address, chain, contentTypeHint);
    if (!collectionInfo) {
      throw { code: 'NOT_FOUND', message: 'Collection not found' };
    }
    
    const contentType = collectionInfo.type;
    console.log(`Using content type: ${contentType}`);
    
    // Create the tracker
    const tracker = ContentTrackerFactory.getTracker(address, contentType, chain);
    
    // Get token IDs for this collection
    const tokenIds = await tracker.getAllTokens({ maxTokens: limit * 2 });
    console.log(`Found ${tokenIds.length} tokens for collection ${address}`);
    
    // Get metadata for each token
    const items = [];
    for (const tokenId of tokenIds.slice(offset, offset + limit)) {
      try {
        const metadata = await tracker.fetchMetadata(tokenId);
        items.push(metadata);
      } catch (error) {
        console.error(`Error fetching metadata for token ${tokenId}:`, error);
        // Add minimal info for failed tokens
        items.push({
          id: `${address}-${tokenId}`,
          tokenId,
          error: 'Failed to fetch metadata'
        });
      }
    }
    
    return {
      items,
      pagination: {
        total: tokenIds.length,
        limit,
        offset,
        hasMore: tokenIds.length > offset + limit
      },
      collection: collectionInfo
    };
  } catch (error) {
    console.error('Error fetching collection items:', error);
    throw error;
  }
}