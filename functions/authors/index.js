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
    const path = event.path.replace(/^\/\.netlify\/functions\/authors\/?/, '').split('/');
    const authorId = path[0] || '';
    const subResource = path[1] || '';
    const queryParams = event.queryStringParameters || {};
    
    // Set default values for pagination
    const limit = parseInt(queryParams.limit) || 20;
    const offset = parseInt(queryParams.offset) || 0;
    
    let response;
    
    // Route based on path
    if (!authorId) {
      // GET /authors
      const authors = await getAuthorsList(limit, offset);
      response = createResponse(authors, 200, {}, isFrame);
    } else if (subResource === 'publications') {
      // GET /authors/:id/publications
      const publications = await getAuthorPublications(authorId, limit, offset);
      response = createResponse(publications, 200, {}, isFrame);
    } else {
      // GET /authors/:id
      const author = await getAuthorDetails(authorId);
      if (!author) {
        throw { code: 'NOT_FOUND', message: 'Author not found' };
      }
      response = createResponse(author, 200, {}, isFrame);
    }
    
    // Optimize for Frame if necessary
    return optimizeForFrame(response, isFrame);
  } catch (error) {
    return handleError(error, isFrameRequest(event));
  }
};

/**
 * Get a list of authors
 * @param {number} limit - Number of authors to return
 * @param {number} offset - Pagination offset
 */
async function getAuthorsList() {
  try {
    const { ContentTrackerFactory } = require('@pagedao/core');
    
    // Get all registered content types
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    
    // Supported chains
    const supportedChains = ['base', 'ethereum', 'optimism', 'zora', 'polygon'];
    
    // Array to collect all authors
    const allAuthors = [];
    
    // Loop through chains and content types
    for (const chain of supportedChains) {
      for (const contentType of contentTypes) {
        try {
          // Get contract address from environment or config
          const contractAddress = process.env[`${chain.toUpperCase()}_${contentType.toUpperCase()}_CONTRACT`] || '';
          if (!contractAddress) continue;
          
          const tracker = ContentTrackerFactory.getTracker(contractAddress, contentType, chain);
          
          // Get authors - depending on your API, you might need to call a different method
          if (tracker.getAuthors) {
            const authors = await tracker.getAuthors();
            allAuthors.push(...authors);
          }
        } catch (error) {
          console.warn(`Error getting authors for ${chain}/${contentType}: ${error.message}`);
        }
      }
    }
    
    return allAuthors;
  } catch (error) {
    console.error('Error fetching authors list:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific author
 * @param {string} authorId - The author ID (usually an address)
 */
async function getAuthorDetails(authorId) {
  try {
    const factory = new ContentTrackerFactory();
    const adapters = await factory.getAllContentTrackers();
    
    const authorDetails = {
      address: authorId,
      chains: [],
      publications: [],
      totalPublications: 0
    };
    
    let foundOnAnyChain = false;
    
    // Collect author details from all chains
    for (const adapter of adapters) {
      try {
        const chainAuthor = await adapter.getAuthorByAddress(authorId);
        if (chainAuthor) {
          foundOnAnyChain = true;
          
          // Add chain to the list
          authorDetails.chains.push(chainAuthor.chain);
          
          // Merge other properties
          authorDetails.name = authorDetails.name || chainAuthor.name;
          authorDetails.bio = authorDetails.bio || chainAuthor.bio;
          authorDetails.avatar = authorDetails.avatar || chainAuthor.avatar;
          authorDetails.website = authorDetails.website || chainAuthor.website;
          authorDetails.social = authorDetails.social || chainAuthor.social;
          
          // Track publication count
          authorDetails.totalPublications += chainAuthor.publicationCount || 0;
        }
      } catch (e) {
        // Continue to next adapter
      }
    }
    
    return foundOnAnyChain ? authorDetails : null;
  } catch (error) {
    console.error('Error fetching author details:', error);
    throw error;
  }
}

/**
 * Get publications by a specific author
 * @param {string} authorId - The author ID
 * @param {number} limit - Number of publications to return
 * @param {number} offset - Pagination offset
 */
async function getAuthorPublications(authorId, limit, offset) {
  try {
    const factory = new ContentTrackerFactory();
    const adapters = await factory.getAllContentTrackers();
    const publications = [];
    
    // Collect publications from all chains
    for (const adapter of adapters) {
      try {
        const chainPublications = await adapter.getContentByAuthor(authorId);
        publications.push(...chainPublications);
      } catch (e) {
        // Continue to next adapter
      }
    }
    
    // Sort publications by date (newest first)
    publications.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    
    // Apply pagination
    const paginatedPublications = publications.slice(offset, offset + limit);
    
    return {
      items: paginatedPublications,
      pagination: {
        total: publications.length,
        limit,
        offset,
        hasMore: publications.length > offset + limit
      },
      author: {
        address: authorId,
        publicationCount: publications.length
      }
    };
  } catch (error) {
    console.error('Error fetching author publications:', error);
    throw error;
  }
}
