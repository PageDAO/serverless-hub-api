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
    
    // Special case for batch endpoint (path[0] === 'batch')
    if (path[0] === 'batch') {
      const batchContractAddress = path[1] || queryParams.contract;
      const batchChain = path[2] || queryParams.chain || 'ethereum';
      const batchAssetType = queryParams.assetType || 'nft';
      
      if (!batchContractAddress) {
        return createResponse({ error: 'Contract address is required for batch requests' }, 400, {}, isFrame);
      }
      
      const tokenIds = queryParams.tokenIds ? queryParams.tokenIds.split(',') : [];
      if (tokenIds.length === 0) {
        return createResponse({ error: 'No token IDs provided for batch request' }, 400, {}, isFrame);
      }
      
      // Limit batch size to prevent abuse
      const maxBatchSize = 20;
      const limitedTokenIds = tokenIds.slice(0, maxBatchSize);
      
      try {
        // Fetch metadata for each token ID in parallel
        const includeOwnership = queryParams.includeOwnership === 'true';
        const metadataPromises = limitedTokenIds.map(tokenId => 
          fetchNFTMetadata(
            batchContractAddress, 
            batchAssetType, 
            batchChain, 
            tokenId, 
            { includeOwnership }
          )
        );
        
        const metadataResults = await Promise.all(metadataPromises);
        
        return createResponse({ 
          contractAddress: batchContractAddress,
          chain: batchChain,
          assetType: batchAssetType,
          items: metadataResults,
          count: metadataResults.length,
          request: {
            requested: tokenIds.length,
            processed: limitedTokenIds.length
          }
        }, 200, {}, isFrame);
      } catch (error) {
        console.error('Error fetching batch metadata:', error);
        return createResponse({ 
          error: 'Failed to fetch batch metadata', 
          details: error.message 
        }, 500, {}, isFrame);
      }
    }
    
    if (!contractAddress) {
      return createResponse({ error: 'Contract address is required' }, 400, {}, isFrame);
    }
    
    // Handle collection metadata queries
    if (path[2] === 'collection-info') {
      try {
        // For collection metadata, we need to make a few contract calls
        // We'll use a representative token ID to get basic metadata
        const representativeTokenId = '1'; // Most collections start at token ID 1
        
        // Get basic collection metadata from a representative token
        const metadata = await fetchNFTMetadata(
          contractAddress, 
          assetType, 
          chain, 
          representativeTokenId
        );
        
        // We might need additional information from the contract
        // This would depend on the contract's ABI and available methods
        // For now, we'll return what we have from the metadata
        
        return createResponse({
          name: metadata.title || 'Unknown Collection',
          description: metadata.description || '',
          contractAddress,
          chain,
          assetType,
          imageURI: metadata.imageURI || '',
          creator: metadata.creator || '',
          symbol: metadata.additionalData?.symbol || '',
          totalSupply: metadata.totalSupply || undefined,
          maxSupply: metadata.maxSupply || undefined,
          format: metadata.format || 'nft',
          collectionData: {
            representativeTokenId: representativeTokenId,
            representativeMetadata: metadata
          }
        }, 200, {}, isFrame);
      } catch (error) {
        console.error('Error fetching collection info:', error);
        return createResponse({ 
          error: 'Failed to fetch collection info', 
          details: error.message 
        }, 500, {}, isFrame);
      }
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