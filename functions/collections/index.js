const { rateLimitCheck } = require('../utils/rateLimiter');
const { createResponse } = require('../utils/responseFormatter');
const { handleError } = require('../utils/errorHandler');
const { isFrameRequest, optimizeForFrame } = require('../utils/frameDetection');
const { ContentTrackerFactory } = require('@pagedao/core');
const { getContracts } = require('../../contracts/registry');

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
async function getCollectionsList(chain, limit, offset) {
  try {
    console.log(`Fetching collections for chain: ${chain}`);
    
    const { ContentTrackerFactory } = require('@pagedao/core');
    
    // Get all registered content types
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    console.log('Registered content types:', contentTypes);
    
    // Get contracts from registry
    const registryContracts = getContracts(chain);
    console.log(`Found ${registryContracts.length} contracts in registry for ${chain}`);
    
    // Array to collect all collections with metadata
    const allCollections = [];
    
    // Loop through registry contracts
    for (const contractInfo of registryContracts) {
      try {
        const { address, type, chain: contractChain } = contractInfo;
        
        // Skip if the content type isn't registered
        if (!contentTypes.includes(type)) {
          console.warn(`Content type ${type} not registered, skipping ${address}`);
          continue;
        }
        
        console.log(`Creating tracker for ${contractChain}/${type}/${address}`);
        
        // Get a tracker for this contract
        const tracker = ContentTrackerFactory.getTracker(address, type, contractChain);
        
        // Get collection info from blockchain
        try {
          console.log(`Fetching collection info for ${address}`);
          const onchainInfo = await tracker.getCollectionInfo();
          
          // Merge registry data with on-chain data
          allCollections.push({
            ...contractInfo,
            ...onchainInfo,
            // Ensure these are from registry even if onchain info has them
            address: contractInfo.address,
            type: contractInfo.type,
            chain: contractChain
          });
          
          console.log(`Successfully added collection ${address}`);
        } catch (error) {
          console.error(`Error fetching collection info for ${address}:`, error);
          
          // Add registry data even if blockchain data fetch failed
          allCollections.push({
            ...contractInfo,
            // Note that this is fallback data
            _fromRegistry: true,
            _blockchainFetchError: error.message
          });
        }
      } catch (error) {
        console.error(`Error processing contract ${contractInfo.address}:`, error.message);
      }
    }
    
    // Sort collections - featured first, then alphabetically
    allCollections.sort((a, b) => {
      // Sort featured collections first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      
      // Then sort alphabetically by name
      return (a.name || '').localeCompare(b.name || '');
    });
    
    console.log(`Returning ${allCollections.length} collections`);
    
    // Apply final pagination
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
 * @param {string} chain - The blockchain to search on, or 'all'
 */
async function getCollectionDetails(address, chain) {
  try {
    console.log(`Fetching collection details for address: ${address}`);
    
    // First check registry for this collection
    const allContracts = getContracts('all');
    const registryInfo = allContracts.find(contract => 
      contract.address.toLowerCase() === address.toLowerCase()
    );
    
    if (!registryInfo) {
      console.log(`Collection ${address} not found in registry`);
      // Not in registry, but we can still try to look it up on-chain if chain is specified
      if (chain && chain !== 'all') {
        return await fetchCollectionFromBlockchain(address, chain);
      }
      return null;
    }
    
    // Found in registry, get on-chain data as well
    const { type, chain: registryChain } = registryInfo;
    const onChainCollection = await fetchCollectionFromBlockchain(
      address, 
      chain === 'all' ? registryChain : chain
    );
    
    // Merge registry data with on-chain data, prioritizing registry for duplicates
    return {
      ...onChainCollection,
      ...registryInfo,
      // Ensure these registry fields override blockchain data
      address: registryInfo.address,
      type: registryInfo.type,
      chain: registryChain
    };
  } catch (error) {
    console.error('Error fetching collection details:', error);
    throw error;
  }
}

/**
 * Helper function to fetch collection details from blockchain
 * @param {string} address - Collection address
 * @param {string} chain - Blockchain to search on
 */
async function fetchCollectionFromBlockchain(address, chain) {
  const factory = new ContentTrackerFactory();
    
  try {
    console.log(`Trying to fetch collection ${address} from ${chain} blockchain`);
    
    // We need to know the content type to get the right tracker
    // This requires looking through all registered types
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    
    // Try each content type until we find one that works
    for (const contentType of contentTypes) {
      try {
        console.log(`Trying content type ${contentType} for ${address}`);
        const tracker = ContentTrackerFactory.getTracker(address, contentType, chain);
        const collectionInfo = await tracker.getCollectionInfo();
        
        // If we get here, we found it
        console.log(`Found collection ${address} as type ${contentType}`);
        return {
          ...collectionInfo,
          type: contentType,
          chain: chain,
          address: address
        };
      } catch (error) {
        // Not this type, continue to next
        console.log(`${contentType} didn't work for ${address}: ${error.message}`);
      }
    }
    
    // If we get here, we tried all content types and none worked
    console.log(`Collection ${address} not found with any content type`);
    return null;
  } catch (error) {
    console.error(`Error in fetchCollectionFromBlockchain for ${address}:`, error);
    return null;
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
    console.log(`Fetching items for collection ${address}`);
    
    // Find collection in registry to get the content type
    const allContracts = getContracts('all');
    const registryInfo = allContracts.find(contract => 
      contract.address.toLowerCase() === address.toLowerCase()
    );
    
    // If not in registry, try to determine type
    if (!registryInfo) {
      console.log(`Collection ${address} not found in registry`);
      return await fetchItemsWithoutRegistry(address, chain, limit, offset);
    }
    
    // Use registry info to get the right content type and chain
    const { type, chain: registryChain } = registryInfo;
    const targetChain = chain === 'all' ? registryChain : chain;
    
    console.log(`Getting items for ${address} as ${type} on ${targetChain}`);
    
    const tracker = ContentTrackerFactory.getTracker(address, type, targetChain);
    
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
      collection: {
        ...registryInfo,
        address,
        chain: targetChain
      }
    };
  } catch (error) {
    console.error('Error fetching collection items:', error);
    throw error;
  }
}

/**
 * Helper function to fetch collection items when registry info isn't available
 * @param {string} address - Collection address
 * @param {string} chain - Blockchain to search on
 * @param {number} limit - Number of items to return
 * @param {number} offset - Pagination offset
 */
async function fetchItemsWithoutRegistry(address, chain, limit, offset) {
  try {
    // Need to try each content type
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    const chains = chain === 'all' ? ['ethereum', 'base', 'optimism', 'zora', 'polygon'] : [chain];
    
    for (const chainName of chains) {
      for (const contentType of contentTypes) {
        try {
          console.log(`Trying ${contentType} on ${chainName} for ${address}`);
          const tracker = ContentTrackerFactory.getTracker(address, contentType, chainName);
          
          // See if we can get token IDs for this collection
          const tokenIds = await tracker.getAllTokens({ maxTokens: limit * 2 });
          
          if (tokenIds.length > 0) {
            console.log(`Found tokens as ${contentType} on ${chainName}`);
            
            // Get metadata for each token
            const items = [];
            for (const tokenId of tokenIds.slice(offset, offset + limit)) {
              try {
                const metadata = await tracker.fetchMetadata(tokenId);
                items.push(metadata);
              } catch (error) {
                console.error(`Error fetching metadata for token ${tokenId}:`, error);
                items.push({
                  id: `${address}-${tokenId}`,
                  tokenId,
                  error: 'Failed to fetch metadata'
                });
              }
            }
            
            // Get collection info
            const collectionInfo = await tracker.getCollectionInfo();
            
            return {
              items,
              pagination: {
                total: tokenIds.length,
                limit,
                offset,
                hasMore: tokenIds.length > offset + limit
              },
              collection: {
                ...collectionInfo,
                address,
                chain: chainName,
                type: contentType
              }
            };
          }
        } catch (error) {
          // Not this type or chain, continue to next
          console.log(`Failed with ${contentType} on ${chainName}: ${error.message}`);
        }
      }
    }
    
    // If we get here, we couldn't find any tokens for this collection
    throw { code: 'NOT_FOUND', message: 'No tokens found for collection' };
  } catch (error) {
    console.error('Error in fetchItemsWithoutRegistry:', error);
    throw error;
  }
}