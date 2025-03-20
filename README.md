# PageDAO API

API endpoints for PageDAO Hub providing token metrics and analytics.

## Endpoints

### Token Prices

```
GET /token-prices
```

Returns current PAGE token prices across all networks, TVL data, and market metrics.

#### Response Format

```json
{
  "timestamp": 1742422339998,
  "prices": {
    "ethereum": 0.0009987517597018379,
    "optimism": 0.000868414092192231,
    "base": 0.0012145095571942511,
    "osmosis": 0.0012284914202457435,
    "weighted": 0.0010876543210987654
  },
  "ethPrice": 2039.0481063402617,
  "tvl": {
    "ethereum": 2232.807674748349,
    "optimism": 262.83570320986814,
    "base": 479.48196085196537,
    "osmosis": 2937.0646185289042,
    "total": 5912.189957839087
  },
  "weights": {
    "ethereum": 0.3776616940354998,
    "optimism": 0.04445657279390989,
    "base": 0.08110056752435046,
    "osmosis": 0.49678116564623975
  },
  "supply": {
    "circulating": 42500000,
    "total": 100000000
  },
  "marketCap": 46225309.14669935,
  "fdv": 108765432.10987654
}
```

### Historical Data

```
GET /historical-data?chain=all&period=24h
```

Returns historical price data for the specified chain and time period.

#### Query Parameters

- `chain`: Chain to get data for (ethereum, optimism, base, osmosis, or all). Default: all
- `period`: Time period (24h, 7d, 30d). Default: 24h

#### Response Format (chain=all)

```json
{
  "period": "24h",
  "dataPoints": [
    {
      "timestamp": 1742422339998,
      "ethereum": 0.0009987517597018379,
      "optimism": 0.000868414092192231,
      "base": 0.0012145095571942511,
      "osmosis": 0.0012284914202457435,
      "ethPrice": 2039.0481063402617
    },
    {
      "timestamp": 1742422939998,
      "ethereum": 0.0009995517597018379,
      "optimism": 0.000870414092192231,
      "base": 0.0012155095571942511,
      "osmosis": 0.0012294914202457435,
      "ethPrice": 2042.0481063402617
    }
    // Additional data points...
  ]
}
```

#### Response Format (chain=ethereum)

```json
{
  "chain": "ethereum",
  "period": "24h",
  "dataPoints": [
    {
      "timestamp": 1742422339998,
      "price": 0.0009987517597018379
    },
    {
      "timestamp": 1742422939998,
      "price": 0.0009995517597018379
    }
    // Additional data points...
  ]
}
```

## Development

### Prerequisites

- Node.js v18 or higher
- Netlify CLI

### Installation

```bash
# Install dependencies
npm install

# Install Netlify CLI globally
npm install -g netlify-cli
```

### Local Development

```bash
# Start local development server
npm run dev
```

This will start the Netlify dev server at http://localhost:8888.

### Deployment

```bash
# Deploy to Netlify
npm run deploy
```

## Environment Variables

The API uses the following environment variables:

- `ETH_RPC_URL`: Ethereum RPC URL
- `ETH_BACKUP_RPC_URL`: Backup Ethereum RPC URL
- `OPTIMISM_RPC_URL`: Optimism RPC URL
- `OPTIMISM_BACKUP_RPC_URL`: Backup Optimism RPC URL
- `BASE_RPC_URL`: Base RPC URL
- `BASE_BACKUP_RPC_URL`: Backup Base RPC URL
- `CACHE_DURATION`: Cache duration in milliseconds (default: 300000)

### Network Comparison

```
GET /network-comparison
```

Returns network comparison data including arbitrage opportunities and price differences from the weighted average.

#### Response Format

```json
{
  "timestamp": 1742422339998,
  "weightedPrice": 0.0010876543210987654,
  "priceComparison": {
    "ethereum": {
      "price": 0.0009987517597018379,
      "diffFromWeighted": -8.17,
      "tvl": 2232.807674748349,
      "weight": 0.3776616940354998
    },
    "optimism": {
      "price": 0.000868414092192231,
      "diffFromWeighted": -20.15,
      "tvl": 262.83570320986814,
      "weight": 0.04445657279390989
    },
    "base": {
      "price": 0.0012145095571942511,
      "diffFromWeighted": 11.66,
      "tvl": 479.48196085196537,
      "weight": 0.08110056752435046
    },
    "osmosis": {
      "price": 0.0012284914202457435,
      "diffFromWeighted": 12.95,
      "tvl": 2937.0646185289042,
      "weight": 0.49678116564623975
    }
  },
  "arbitrageOpportunities": [
    {
      "from": "optimism",
      "to": "osmosis",
      "fromPrice": 0.000868414092192231,
      "toPrice": 0.0012284914202457435,
      "priceDifference": 41.46,
      "potentialGain": 0.00036007732805351243
    },
    {
      "from": "ethereum",
      "to": "osmosis",
      "fromPrice": 0.0009987517597018379,
      "toPrice": 0.0012284914202457435,
      "priceDifference": 23.00,
      "potentialGain": 0.00022971290343142273
    }
    // Additional opportunities...
  ]
}

## License

MIT
