const { fetchNFTMetadata, isOwnedBy, getTokensForOwner } = require('@pagedao/core');
const { rateLimitCheck } = require('../utils/rateLimiter');
const { createResponse } = require('../utils/responseFormatter');
const { handleError } = require('../utils/errorHandler');
const { isFrameRequest, optimizeForFrame } = require('../utils/frameDetection');

exports.handler = async function(event) {
  try {
    // Check rate limiting
    const rateLimitResponse = await rateLimitCheck(event);
    if (rateLimitResponse) return rateLimitResponse;
    
    // Detect if request is from a Frame
    const isFrame = isFrameRequest(event);
    
    // Parse path and query parameters
    const path = event.path.replace(/^\/\.netlify\/functions\/nft\/?/, '').split('/');
    const queryParams = event.queryStringParameters || {};
    
    // Extract parameters from path or query
    const contractAddress = path[0] || queryParams.contract;
    const chain = path[1] || queryParams.chain || 'ethereum';
    const assetType = queryParams.assetType || 'nft';
    
    if (!contractAddress) {
      return createResponse({ error: 'Contract address is required' }, 400, {}, isFrame);
    }
    
    // Handle ownership queries
    if (path[2] === 'owner' && path[3]) {
      const ownerAddress = path[3];
      try {
        const tokens = await getTokensForOwner(contractAddress, assetType, chain, ownerAddress);
        return createResponse({ tokens }, 200, {}, isFrame);
      } catch (error) {
        console.error('Error getting tokens for owner:', error);
        return createResponse({ 
          error: 'Failed to get tokens', 
          details: error.message 
        }, 500, {}, isFrame);
      }
    }
    
    // Handle ownership check
    if (path[2] === 'check-ownership' && path[3] && queryParams.address) {
      const tokenId = path[3];
      const ownerAddress = queryParams.address;
      try {
        const owned = await isOwnedBy(contractAddress, assetType, chain, tokenId, ownerAddress);
        return createResponse({ owned }, 200, {}, isFrame);
      } catch (error) {
        console.error('Error checking ownership:', error);
        return createResponse({ 
          error: 'Failed to check ownership', 
          details: error.message 
        }, 500, {}, isFrame);
      }
    }
    
    // Handle token metadata queries
    const tokenId = path[2] || queryParams.tokenId;
    if (tokenId) {
      try {
        const includeOwnership = queryParams.includeOwnership === 'true';
        const metadata = await fetchNFTMetadata(
          contractAddress, 
          assetType, 
          chain, 
          tokenId, 
          { includeOwnership }
        );
        return createResponse(metadata, 200, {}, isFrame);
      } catch (error) {
        console.error('Error fetching metadata:', error);
        return createResponse({ 
          error: 'Failed to fetch metadata', 
          details: error.message 
        }, 500, {}, isFrame);
      }
    }
    
    // If no tokenId specified, return error
    return createResponse({ error: 'Token ID is required' }, 400, {}, isFrame);
  } catch (error) {
    console.error('API Error:', error);
    return handleError(error, isFrameRequest(event));
  }
};

/**
 * Helper function to check token ownership
 */
async function checkTokenOwnership(event) {
  try {
    const { contractAddress, chainId, tokenId, ownerAddress } = event.queryStringParameters || {};
    
    if (!contractAddress || !chainId || !tokenId || !ownerAddress) {
      return createResponse({ 
        error: 'Missing required parameters: contractAddress, chainId, tokenId, ownerAddress'
      }, 400);
    }
    
    const assetType = event.queryStringParameters.assetType || 'nft';
    
    const isOwned = await isOwnedBy(
      contractAddress,
      assetType, 
      chainId,
      tokenId,
      ownerAddress
    );
    
    return createResponse({ isOwned }, 200);
  } catch (error) {
    return handleError(error);
  }
}
