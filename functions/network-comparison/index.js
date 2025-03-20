// functions/network-comparison/index.js
const { fetchPagePrices, fetchAllTVL, calculateTVLWeights } = require('@pagedao/core');

exports.handler = async function(event) {
  try {
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
    
    // Prepare response
    const response = {
      timestamp: Date.now(),
      weightedPrice: weightedAvgPrice,
      priceComparison: priceComparison,
      arbitrageOpportunities: arbitrageOpportunities
    };
    
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
    console.error('Error in network comparison API:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        error: 'Failed to fetch network comparison data',
        message: error.message
      })
    };
  }
};