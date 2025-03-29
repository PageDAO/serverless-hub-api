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
    const path = event.path.replace(/^\/\.netlify\/functions\/books\/?/, '').split('/');
    const segment = path[0] || '';
    const queryParams = event.queryStringParameters || {};
    
    // Set default values for pagination
    const limit = parseInt(queryParams.limit) || 20;
    const offset = parseInt(queryParams.offset) || 0;
    const chain = queryParams.chain || 'all';
    
    let response;
    
    // Route based on path
    if (!segment) {
      // GET /books
      const books = await getBooksList(chain, limit, offset);
      response = createResponse(books, 200, {}, isFrame);
    } else if (segment === 'featured') {
      // GET /books/featured
      const featuredBooks = await getFeaturedBooks(chain, limit);
      response = createResponse(featuredBooks, 200, {}, isFrame);
    } else {
      // GET /books/:id
      const book = await getBookDetails(segment);
      if (!book) {
        throw { code: 'NOT_FOUND', message: 'Book not found' };
      }
      response = createResponse(book, 200, {}, isFrame);
    }
    
    // Optimize for Frame if necessary
    return optimizeForFrame(response, isFrame);
  } catch (error) {
    return handleError(error, isFrameRequest(event));
  }
};

/**
 * Get a list of books
 * @param {string} chain - Blockchain to filter by, or 'all'
 * @param {number} limit - Number of books to return
 * @param {number} offset - Pagination offset
 */
async function getBooksList(chain, limit, offset) {
  try {
    // Get all registered content types
    const contentTypes = ContentTrackerFactory.getRegisteredTypes();
    
    // Supported chains
    const supportedChains = ['base', 'ethereum', 'optimism', 'zora', 'polygon'];
    
    // Array to collect all books
    const allBooks = [];
    
    // Loop through chains and content types
    for (const chain of supportedChains) {
      for (const contentType of contentTypes) {
        try {
          // Try to get a tracker for each chain and content type
          // You'll need to have environment variables or configuration for contract addresses
          const contractAddress = process.env[`${chain.toUpperCase()}_${contentType.toUpperCase()}_CONTRACT`] || '';
          if (!contractAddress) continue;
          
          const tracker = ContentTrackerFactory.getTracker(contractAddress, contentType, chain);
          
          // Get books using the tracker
          const books = await tracker.fetchMetadata();
          allBooks.push(...books);
        } catch (error) {
          console.warn(`Error getting books for ${chain}/${contentType}: ${error.message}`);
        }
      }
    }
    
    // Sort all books by some criteria (e.g. date, popularity)
    allBooks.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    
    // Apply final pagination if needed
    return {
      items: allBooks.slice(0, limit),
      pagination: {
        total: allBooks.length, // This would be the total count from all sources
        limit,
        offset,
        hasMore: allBooks.length > offset + limit
      }
    };
  } catch (error) {
    console.error('Error fetching books list:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific book
 * @param {string} bookId - The book ID
 */
async function getBookDetails(bookId) {
  try {
    // Parse the book ID to get chain and local ID if needed
    // Format could be chain:localId or just localId
    let chain, localId;
    
    if (bookId.includes(':')) {
      [chain, localId] = bookId.split(':');
    } else {
      localId = bookId;
      // You'd need logic to determine which chain this book belongs to
      // For now we'll try to find it across all chains
    }
    
    const factory = new ContentTrackerFactory();
    
    if (chain) {
      // If chain is specified, only look there
      const adapter = await factory.getContentTrackerForChain(chain);
      if (!adapter) {
        throw { code: 'INVALID_PARAM', message: `Invalid chain: ${chain}` };
      }
      return await adapter.getById(localId);
    } else {
      // Search across all chains
      const adapters = await factory.getAllContentTrackers();
      
      for (const adapter of adapters) {
        try {
          const book = await adapter.getById(localId);
          if (book) return book;
        } catch (e) {
          // Continue to next adapter if not found
        }
      }
    }
    
    // If we get here, the book wasn't found
    return null;
  } catch (error) {
    console.error('Error fetching book details:', error);
    throw error;
  }
}

/**
 * Get featured books
 * @param {string} chain - Blockchain to filter by, or 'all'
 * @param {number} limit - Number of books to return
 */
async function getFeaturedBooks(chain, limit) {
  // This would typically use some criteria to determine featured books
  // For now, we'll just return the most recent books
  const books = await getBooksList(chain, limit, 0);
  
  // You might add additional metadata to indicate why they're featured
  books.items = books.items.map(book => ({
    ...book,
    featured: true,
    featuredReason: 'Recently published'
  }));
  
  return books;
}
