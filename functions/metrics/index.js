const { rateLimitCheck } = require('../utils/rateLimiter');
const { createResponse } = require('../utils/responseFormatter');
const { handleError } = require('../utils/errorHandler');
const { isFrameRequest, optimizeForFrame } = require('../utils/frameDetection');
const { fetchPagePrices, fetchAllTVL, calculateTVLWeights } = require('@pagedao/core');

exports.handler = async function(event) {
  try {
    // Check rate limiting
    const rateLimitResponse = await rateLimitCheck(event);
    if (rateLimitResponse) return rateLimitResponse;
    
    // Detect if request is from a Frame
    const isFrame = isFrameRequest(event);
    
    // Parse path and query parameters
    const path = event.path.replace(/^\/\.netlify\/functions\/metrics\/?/, '').split('/');
    const metricType = path[0] || 'summary';
    const queryParams = event.queryStringParameters || {};
    
    let response;
    
    // Route based on path
    switch (metricType) {
      case 'token-prices':
        response = await handleTokenPrices(queryParams, isFrame);
        break;
      case 'network-comparison':
        response = await handleNetworkComparison(queryParams, isFrame);
        break;
      case 'historical-data':
        response = await handleHistoricalData(queryParams, isFrame);
        break;
      case 'tvl':
        response = await handleTVL(queryParams, isFrame);
        break;
      case 'summary':
      default:
        response = await handleMetricsSummary(queryParams, isFrame);
        break;
    }
    
    // Optimize for Frame if necessary
    return optimizeForFrame(response, isFrame);
  } catch (error) {
    return handleError(error, isFrameRequest(event));
  }
};

/**
 * Handle token prices endpoint
 * @param {Object} params - Query parameters
 * @param {boolean} isFrame - Whether this is a Frame request
 */
async function handleTokenPrices(params, isFrame) {
  console.log('Token prices API request received');
  
  // Fetch latest prices
  const priceData = await fetchPagePrices();
  
  // Fetch TVL data
  const tvlData = await fetchAllTVL(priceData);
  
  // Calculate TVL weights
  const weights = calculateTVLWeights(tvlData);
  
  // Calculate weighted average price
  const weightedAvgPrice = (
    priceData.ethereum * weights.ethereum +
    priceData.optimism * weights.optimism +
    priceData.base * weights.base +
    priceData.osmosis * weights.osmosis
  );
  
  // Calculate market cap and FDV
  const CIRCULATING_SUPPLY = 42500000;
  const TOTAL_SUPPLY = 100000000;
  
  const marketCap = weightedAvgPrice * CIRCULATING_SUPPLY;
  const fdv = weightedAvgPrice * TOTAL_SUPPLY;
  
  // Prepare response data
  const data = {
    timestamp: Date.now(),
    prices: {
      ethereum: priceData.ethereum,
      optimism: priceData.optimism,
      base: priceData.base,
      osmosis: priceData.osmosis,
      weighted: weightedAvgPrice
    },
    ethPrice: priceData.ethPrice,
    tvl: {
      ethereum: tvlData.ethereum,
      optimism: tvlData.optimism,
      base: tvlData.base,
      osmosis: tvlData.osmosis,
      total: tvlData.ethereum + tvlData.optimism + tvlData.base + tvlData.osmosis
    },
    weights: weights,
    supply: {
      circulating: CIRCULATING_SUPPLY,
      total: TOTAL_SUPPLY
    },
    marketCap: marketCap,
    fdv: fdv
  };
  
  return createResponse(data, 200, { 'Cache-Control': 'public, max-age=60' }, isFrame);
}

/**
 * Handle network comparison endpoint
 * @param {Object} params - Query parameters
 * @param {boolean} isFrame - Whether this is a Frame request
 */
async function handleNetworkComparison(params, isFrame) {
  console.log('Network comparison API request received');
  
  // Fetch latest prices
  const priceData = await fetchPagePrices();
  
  // Fetch TVL data
  const tvlData = await fetchAllTVL(priceData);
  
  // Calculate TVL weights
  const weights = calculateTVLWeights(tvlData);
  
  // Calculate weighted average price
  const weightedAvgPrice = (
    priceData.ethereum * weights.ethereum +
    priceData.optimism * weights.optimism +
    priceData.base * weights.base +
    priceData.osmosis * weights.osmosis
  );
  
  // Calculate arbitrage opportunities
  const networks = ['ethereum', 'optimism', 'base', 'osmosis'];
  const arbitrageOpportunities = [];
  
  for (const sourceNetwork of networks) {
    for (const targetNetwork of networks) {
      if (sourceNetwork === targetNetwork) continue;
      
      const sourcePrice = priceData[sourceNetwork];
      const targetPrice = priceData[targetNetwork];
      const priceDiff = ((targetPrice / sourcePrice) - 1) * 100;
      
      // Only include opportunities with >0.5% difference
      if (priceDiff > 0.5) {
        arbitrageOpportunities.push({
          from: sourceNetwork,
          to: targetNetwork,
          fromPrice: sourcePrice,
          toPrice: targetPrice,
          priceDifference: priceDiff,
          potentialGain: sourcePrice * (priceDiff / 100)
        });
      }
    }
  }
  
  // Sort by price difference (descending)
  arbitrageOpportunities.sort((a, b) => b.priceDifference - a.priceDifference);
  
  // Calculate price comparison to weighted average
  const priceComparison = {};
  for (const network of networks) {
    const price = priceData[network];
    const diffFromWeighted = ((price / weightedAvgPrice) - 1) * 100;
    
    priceComparison[network] = {
      price: price,
      diffFromWeighted: diffFromWeighted,
      tvl: tvlData[network],
      weight: weights[network]
    };
  }
  
  // Prepare response data
  const data = {
    timestamp: Date.now(),
    weightedPrice: weightedAvgPrice,
    priceComparison: priceComparison,
    arbitrageOpportunities: arbitrageOpportunities
  };
  
  return createResponse(data, 200, { 'Cache-Control': 'public, max-age=60' }, isFrame);
}

/**
 * Handle historical data endpoint
 * @param {Object} params - Query parameters
 * @param {boolean} isFrame - Whether this is a Frame request
 */
async function handleHistoricalData(params, isFrame) {
  const chain = params.chain || 'all';
  const period = params.period || '24h';
  
  console.log(`Historical data API request received: chain=${chain}, period=${period}`);
  
  // Validate parameters
  const validChains = ['ethereum', 'optimism', 'base', 'osmosis', 'all'];
  const validPeriods = ['24h', '7d', '30d'];
  
  if (!validChains.includes(chain)) {
    throw { code: 'INVALID_PARAM', message: `Invalid chain: ${chain}` };
  }
  
  if (!validPeriods.includes(period)) {
    throw { code: 'INVALID_PARAM', message: `Invalid period: ${period}` };
  }
  
  // For this example, we'll generate mock historical data
  // In a real implementation, you'd fetch this from your database
  const dataPoints = generateMockHistoricalData(chain, period);
  
  // Prepare response data
  const data = {
    chain: chain !== 'all' ? chain : undefined,
    period,
    dataPoints
  };
  
  return createResponse(data, 200, { 'Cache-Control': 'public, max-age=300' }, isFrame);
}

/**
 * Handle TVL endpoint
 * @param {Object} params - Query parameters
 * @param {boolean} isFrame - Whether this is a Frame request
 */
async function handleTVL(params, isFrame) {
  console.log('TVL API request received');
  
  // Fetch latest prices and TVL data
  const priceData = await fetchPagePrices();
  const tvlData = await fetchAllTVL(priceData);
  
  // Calculate total TVL
  const totalTVL = tvlData.ethereum + tvlData.optimism + tvlData.base + tvlData.osmosis;
  
  // Calculate TVL weights
  const weights = calculateTVLWeights(tvlData);
  
  // Prepare response data
  const data = {
    timestamp: Date.now(),
    tvl: {
      ethereum: tvlData.ethereum,
      optimism: tvlData.optimism,
      base: tvlData.base,
      osmosis: tvlData.osmosis,
      total: totalTVL
    },
    weights: weights,
    ethPrice: priceData.ethPrice
  };
  
  return createResponse(data, 200, { 'Cache-Control': 'public, max-age=60' }, isFrame);
}

/**
 * Handle metrics summary endpoint
 * @param {Object} params - Query parameters
 * @param {boolean} isFrame - Whether this is a Frame request
 */
async function handleMetricsSummary(params, isFrame) {
  console.log('Metrics summary API request received');
  
  // Fetch latest prices
  const priceData = await fetchPagePrices();
  
  // Fetch TVL data
  const tvlData = await fetchAllTVL(priceData);
  
  // Calculate TVL weights
  const weights = calculateTVLWeights(tvlData);
  
  // Calculate weighted average price
  const weightedAvgPrice = (
    priceData.ethereum * weights.ethereum +
    priceData.optimism * weights.optimism +
    priceData.base * weights.base +
    priceData.osmosis * weights.osmosis
  );
  
  // Calculate market cap
  const CIRCULATING_SUPPLY = 42500000;
  const marketCap = weightedAvgPrice * CIRCULATING_SUPPLY;
  
  // Prepare summary data
  const data = {
    timestamp: Date.now(),
    pagePrice: weightedAvgPrice,
    marketCap: marketCap,
    totalTVL: tvlData.ethereum + tvlData.optimism + tvlData.base + tvlData.osmosis,
    chains: {
      ethereum: {
        price: priceData.ethereum,
        tvl: tvlData.ethereum
      },
      optimism: {
        price: priceData.optimism,
        tvl: tvlData.optimism
      },
      base: {
        price: priceData.base,
        tvl: tvlData.base
      },
      osmosis: {
        price: priceData.osmosis,
        tvl: tvlData.osmosis
      }
    },
    ethPrice: priceData.ethPrice
  };
  
  return createResponse(data, 200, { 'Cache-Control': 'public, max-age=60' }, isFrame);
}

/**
 * Generate mock historical data for demonstration
 * @param {string} chain - The chain to generate data for
 * @param {string} period - The time period
 */
function generateMockHistoricalData(chain, period) {
  const now = Date.now();
  const dataPoints = [];
  
  // Determine number of data points and interval based on period
  let numPoints, interval;
  switch (period) {
    case '24h':
      numPoints = 24;
      interval = 60 * 60 * 1000; // 1 hour
      break;
    case '7d':
      numPoints = 7;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '30d':
      numPoints = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    default:
      numPoints = 24;
      interval = 60 * 60 * 1000;
  }
  
  // Generate data points
  for (let i = 0; i < numPoints; i++) {
    const timestamp = now - (i * interval);
    
    if (chain === 'all') {
      // For 'all', include data for all chains
      dataPoints.push({
        timestamp,
        ethereum: 0.0009987517597018379 + (Math.random() * 0.0001),
        optimism: 0.000868414092192231 + (Math.random() * 0.0001),
        base: 0.0012145095571942511 + (Math.random() * 0.0001),
        osmosis: 0.0012284914202457435 + (Math.random() * 0.0001),
        ethPrice: 2039.0481063402617 + (Math.random() * 20)
      });
    } else {
      // For specific chain, just include that chain's data
      dataPoints.push({
        timestamp,
        price: chain === 'ethereum' ? 0.0009987517597018379 + (Math.random() * 0.0001) :
               chain === 'optimism' ? 0.000868414092192231 + (Math.random() * 0.0001) :
               chain === 'base' ? 0.0012145095571942511 + (Math.random() * 0.0001) :
               0.0012284914202457435 + (Math.random() * 0.0001)
      });
    }
  }
  
  // Sort by timestamp (ascending)
  dataPoints.sort((a, b) => a.timestamp - b.timestamp);
  
  return dataPoints;
}
