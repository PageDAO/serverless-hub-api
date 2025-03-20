const { fetchPagePrices, fetchAllTVL, calculateTVLWeights } = require('@pagedao/core');


// Simple in-memory storage for historical data
// In a production environment, this would be replaced with a database
let historicalData = [];
const MAX_DATA_POINTS = 144; // Store 24 hours of data at 10-minute intervals

// Function to add a new data point and maintain max size
function addDataPoint(dataPoint) {
  historicalData.push(dataPoint);
  if (historicalData.length > MAX_DATA_POINTS) {
    historicalData.shift(); // Remove oldest data point
  }
}

// Initialize with current data on cold start
async function initializeHistoricalData() {
  if (historicalData.length === 0) {
    try {
      const priceData = await fetchPagePrices();
      addDataPoint({
        timestamp: Date.now(),
        ethereum: priceData.ethereum,
        optimism: priceData.optimism,
        base: priceData.base,
        osmosis: priceData.osmosis,
        ethPrice: priceData.ethPrice
      });
    } catch (error) {
      console.error('Error initializing historical data:', error);
    }
  }
}

// Update historical data every 10 minutes
setInterval(async () => {
  try {
    const priceData = await fetchPagePrices();
    addDataPoint({
      timestamp: Date.now(),
      ethereum: priceData.ethereum,
      optimism: priceData.optimism,
      base: priceData.base,
      osmosis: priceData.osmosis,
      ethPrice: priceData.ethPrice
    });
    console.log('Historical data updated, total points:', historicalData.length);
  } catch (error) {
    console.error('Error updating historical data:', error);
  }
}, 10 * 60 * 1000); // Every 10 minutes

exports.handler = async function(event) {
  // Initialize data if needed
  await initializeHistoricalData();
  
  try {
    console.log('Historical data API request received');
    
    // Get query parameters
    const params = event.queryStringParameters || {};
    const chain = params.chain || 'all'; // Get data for specific chain or all
    const period = params.period || '24h'; // Time period (24h, 7d, 30d)
    
    // Filter data based on time period
    let filteredData = [...historicalData];
    const now = Date.now();
    
    if (period === '24h') {
      filteredData = historicalData.filter(dp => dp.timestamp > now - 24 * 60 * 60 * 1000);
    } else if (period === '7d') {
      filteredData = historicalData.filter(dp => dp.timestamp > now - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      filteredData = historicalData.filter(dp => dp.timestamp > now - 30 * 24 * 60 * 60 * 1000);
    }
    
    // If we don't have enough data, just return what we have
    if (filteredData.length === 0) {
      filteredData = historicalData;
    }
    
    // Format response based on requested chain
    let response;
    
    if (chain === 'all') {
      response = {
        period: period,
        dataPoints: filteredData.map(dp => ({
          timestamp: dp.timestamp,
          ethereum: dp.ethereum,
          optimism: dp.optimism,
          base: dp.base,
          osmosis: dp.osmosis,
          ethPrice: dp.ethPrice
        }))
      };
    } else {
      // Return data for a specific chain
      response = {
        chain: chain,
        period: period,
        dataPoints: filteredData.map(dp => ({
          timestamp: dp.timestamp,
          price: dp[chain]
        }))
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Error in historical data API:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        error: 'Failed to fetch historical data',
        message: error.message
      })
    };
  }
};