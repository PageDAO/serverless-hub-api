// functions/books/index.js
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
    const path = event.path.replace(/^\/\.netlify\/functions\/books\/?/, '').split('/');
    const segment = path[0] || '';
    const queryParams = event.queryStringParameters || {};
    
    // Set default values for pagination
    const limit = parseInt(queryParams.limit) || 20;
    const offset = parseInt(queryParams.offset) || 0;
    
    let response;
    
    // Route based on path
    if (!segment) {
      // GET /books - Requires addresses parameter
      if (!queryParams.addresses) {
        throw { code: 'MISSING_PARAM', message: 'Book addresses are required' };
      }
      
      const addresses = queryParams.addresses.split(',');
      const chains = queryParams.chains ? queryParams.chains.split(',') : [];
      
      // Map addresses to chains
      const chainsByAddress = {};
      addresses.forEach((addr, index) => {
        chainsByAddress[addr] = chains[index] || chains[0] || 'ethereum';
      });
      
      const books = await getBooksList(addresses, chainsByAddress, limit, offset);
      response = createResponse(books, 200, {}, isFrame);
    } else if (segment === 'featured') {
      // GET /books/featured - Requires featuredAddresses parameter
      if (!queryParams.featuredAddresses) {
        throw { code: 'MISSING_PARAM', message: 'Featured book addresses are required' };
      }
      
      const addresses = queryParams.featuredAddresses.split(',');
      const chains = queryParams.chains ? queryParams.chains.split(',') : [];
      
      // Map addresses to chains
      const chainsByAddress = {};
      addresses.forEach((addr, index) => {
        chainsByAddress[addr] = chains[index] || chains[0] || 'ethereum';
      });
      
      const featuredBooks = await getFeaturedBooks(addresses, chainsByAddress, limit);
      response = createResponse(featuredBooks, 200, {}, isFrame);
    } else {
      // GET /books/:id - Format: chainName:address or just address with chain in query
      let bookAddress, chain;
      
      if (segment.includes(':')) {
        [chain, bookAddress] = segment.split(':');
      } else {
        bookAddress = segment;
        chain = queryParams.chain;
        
        if (!chain) {
          throw { code: 'MISSING_PARAM', message: 'Chain parameter is required' };
        }
      }
      
      const book = await getBookDetails(bookAddress, chain);
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
 * @param {string[]} addresses - Book contract addresses
 * @param {Object} chainsByAddress - Map of address to chain
 * @param {number} limit - Number of books to return
 * @param {number} offset - Pagination offset
 */
async function getBooksList(addresses, chainsByAddress, limit, offset) {
  try {
    console.log(`Fetching books for ${addresses.length} addresses`);
    
    // Array to collect all books
    const allBooks = [];
    
    // Process each book address
    for (const address of addresses) {
      try {
        const chain = chainsByAddress[address];
        console.log(`Processing book ${address} on ${chain}`);
        
        // Try to get book details
        try {
          const book = await getBookDetails(address, chain);
          if (book) {
            allBooks.push(book);
          }
        } catch (error) {
          console.warn(`Error fetching book ${address}: ${error.message}`);
          // Add minimal info for failed books
          allBooks.push({
            address,
            chain,
            error: error.message,
            _fetchFailed: true
          });
        }
      } catch (error) {
        console.error(`Error processing book address ${address}:`, error.message);
      }
    }
    
    // Sort books by title
    allBooks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    
    // Apply pagination
    return {
      items: allBooks.slice(offset, offset + limit),
      pagination: {
        total: allBooks.length,
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
 * @param {string} address - The book contract address
 * @param {string} chain - The blockchain chain
 */
async function getBookDetails(address, chain) {
  try {
    console.log(`Fetching book details for ${address} on ${chain}`);
    
    // Try each applicable book content type
    const bookContentTypes = ['book', 'alexandria_book'];
    
    for (const type of bookContentTypes) {
      try {
        const tracker = ContentTrackerFactory.getTracker(address, type, chain);
        // Get collection info to verify it works
        const collectionInfo = await tracker.getCollectionInfo();
        
        // This is probably a book, get the first item's metadata
        const tokenIds = await tracker.getAllTokens({ maxTokens: 1 });
        if (tokenIds.length === 0) {
          console.log(`No tokens found for book ${address}`);
          return {
            ...collectionInfo,
            address,
            chain,
            type
          };
        }
        
        const metadata = await tracker.fetchMetadata(tokenIds[0]);
        
        // Combine collection info with token metadata
        return {
          ...collectionInfo,
          ...metadata,
          address,
          chain,
          type,
          tokenId: tokenIds[0]
        };
      } catch (error) {
        console.warn(`Failed with type ${type}: ${error.message}`);
      }
    }
    
    // If we get here, we couldn't find a valid book
    console.log(`No valid book found at ${address} on ${chain}`);
    return null;
  } catch (error) {
    console.error(`Error fetching book details for ${address}:`, error);
    throw error;
  }
}

/**
 * Get featured books
 * @param {string[]} addresses - Featured book addresses
 * @param {Object} chainsByAddress - Map of address to chain
 * @param {number} limit - Number of books to return
 */
async function getFeaturedBooks(addresses, chainsByAddress, limit) {
  try {
    // Get books list with the provided addresses
    const books = await getBooksList(addresses, chainsByAddress, limit, 0);
    
    // Mark books as featured
    books.items = books.items.map(book => ({
      ...book,
      featured: true
    }));
    
    return books;
  } catch (error) {
    console.error('Error fetching featured books:', error);
    throw error;
  }
}