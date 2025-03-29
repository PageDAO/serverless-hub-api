# PageDAO Hub Developer Guide

This document provides technical guidance for developers who want to extend or modify the PageDAO Hub, particularly focusing on adding support for new collection types and blockchains.

## Architecture Overview

The PageDAO Hub consists of several components:

1. **Contract Registry**: JSON files defining showcase collections by chain
2. **API Functions**: Netlify functions providing endpoints for data access
3. **Core Library**: `@pagedao/core` providing blockchain connectivity
4. **Content Adapters**: Classes that standardize access to different contract types

```
┌────────────────┐
│  Frontend UI   │
└───────┬────────┘
        │
┌───────▼────────┐    ┌─────────────────┐
│  API Functions │◄───┤ Contract Registry│
└───────┬────────┘    └─────────────────┘
        │
┌───────▼────────┐
│ @pagedao/core  │
└───────┬────────┘
        │
┌───────▼────────┐
│ Blockchain RPCs │
└────────────────┘
```

## Adding a New Collection Type

To add support for a new type of NFT or content contract:

### 1. Create a Content Adapter

In the `@pagedao/core` library, create a new adapter class:

```javascript
// src/services/newType/NewTypeAdapter.ts
import { BaseContentTracker } from '../baseContentTracker';
import { ContentTrackerFactory } from '../../factory/contentTrackerFactory';

export class NewTypeAdapter extends BaseContentTracker {
  constructor(contractAddress: string, chain: string) {
    super(contractAddress, chain, 'new_type');
    // Initialize any adapter-specific properties
  }
  
  // Implement required methods (see interface)
  async fetchMetadata(tokenId: string) { /* ... */ }
  async fetchOwnership(tokenId: string) { /* ... */ }
  async fetchRights(tokenId: string) { /* ... */ }
  // etc.
}

// Register with the factory
ContentTrackerFactory.registerImplementation('new_type', NewTypeAdapter);
```

### 2. Update Core Library Exports

Make sure your new adapter is properly exported in the core library:

```javascript
// src/index.ts
export * from './services/newType/NewTypeAdapter';
```

### 3. Test the Adapter

Create a test script to verify your adapter works:

```javascript
// src/tests/newTypeAdapter.test.ts
import { ContentTrackerFactory } from '../factory/contentTrackerFactory';

async function testNewTypeAdapter() {
  const address = '0x1234...'; // Test contract address
  const chain = 'ethereum';    // Test chain

  const tracker = ContentTrackerFactory.getTracker(address, 'new_type', chain);
  
  // Test basic functionality
  const info = await tracker.getCollectionInfo();
  console.log('Collection Info:', info);
  
  // Test metadata fetching
  const metadata = await tracker.fetchMetadata('1');
  console.log('Token Metadata:', metadata);
  
  console.log('Test completed successfully!');
}

// Run test if this file is executed directly
if (require.main === module) {
  testNewTypeAdapter().catch(console.error);
}

export { testNewTypeAdapter };
```

### 4. Add to Contract Registry

Once your adapter is working, you can add collections using your new type to the registry:

```json
// contracts/ethereum.json
[
  {
    "address": "0x1234...",
    "name": "My New Collection",
    "type": "new_type",
    "contentType": "article",
    "creator": "Creator Name",
    "description": "Description of the collection",
    "image": "https://example.com/image.png",
    "url": "https://example.com/collection"
  }
]
```

## Adding a New Blockchain

To add support for a new blockchain:

### 1. Update RPC Configuration

In the @pagedao/core library, add RPC URLs for the new chain:

```typescript
// src/utils/config.ts
export const RPC_URLS: { [key: string]: string } = {
  ethereum: process.env.ETH_RPC_URL || 'https://eth.drpc.org',
  optimism: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  // Add new chain
  arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  // ...
};

export const BACKUP_RPC_URLS: { [key: string]: string } = {
  ethereum: process.env.ETH_BACKUP_RPC_URL || 'https://eth.llamarpc.com',
  // ...
  // Add backup URL for new chain
  arbitrum: process.env.ARBITRUM_BACKUP_RPC_URL || 'https://arbitrum.llamarpc.com',
};
```

### 2. Create Registry File

Create a new JSON file for the chain in the contracts directory:

```json
// contracts/arbitrum.json
[
  {
    "address": "0x5678...",
    "name": "Arbitrum Collection",
    "type": "book",
    "contentType": "novel",
    "creator": "Author Name",
    "description": "First collection on Arbitrum",
    "image": "https://example.com/image.png",
    "url": "https://arbitrum.example.com/collection"
  }
]
```

### 3. Update Registry Loader

Update the registry loader to include the new chain:

```javascript
// contracts/registry.js
// Add new import
const arbitrumContracts = require('./arbitrum.json');

const contractRegistry = {
  ethereum: ethereumContracts,
  base: baseContracts,
  optimism: optimismContracts,
  polygon: polygonContracts,
  zora: zoraContracts,
  // Add new chain
  arbitrum: arbitrumContracts
};
```

### 4. Update Collection Endpoints

If your chain has specific requirements, you might need to update the collections endpoint implementation.

## Advanced Customization

### Custom Renderers

To add custom rendering for specific collection types:

1. Create a renderer component in the frontend
2. Add metadata to the registry to indicate which renderer to use:

```json
{
  "address": "0x1234...",
  "name": "Custom Rendered Collection",
  "type": "new_type",
  "renderer": "ThreeDBookRenderer",
  "contentType": "3d-book"
}
```

### Analytics Integration

To track collection usage and performance:

1. Add analytics hooks in the API functions
2. Create a new endpoint for analytics data:

```javascript
// functions/analytics/index.js
exports.handler = async function(event) {
  // Implement analytics collection and reporting
};
```

## Best Practices

1. **Adapter Design**:
   - Use the BaseContentTracker as your foundation
   - Implement proper error handling
   - Add thorough logging for debugging
   - Cache expensive blockchain calls

2. **Test Coverage**:
   - Test with real contract addresses
   - Verify all interface methods work
   - Test edge cases and error conditions

3. **Performance**:
   - Minimize blockchain calls
   - Implement efficient caching
   - Consider fallback mechanisms for RPC failures

4. **Security**:
   - Validate all user inputs
   - Protect against common attack vectors
   - Consider rate limiting for endpoints

## Contributing

We welcome contributions! Please follow these steps:

1. **Discuss First**: Open an issue to discuss your proposed changes
2. **Follow Guidelines**: Adhere to our code style and documentation standards
3. **Test Thoroughly**: Include tests for your new functionality
4. **Submit PR**: Create a pull request with a clear description

## Troubleshooting

### Common Issues

1. **RPC Connection Failures**:
   - Check network connectivity
   - Verify RPC URL format
   - Try alternate RPC providers

2. **Content Adapter Errors**:
   - Verify contract address format
   - Check if contract matches expected type
   - Look for ABI mismatches

3. **Registry Loading Issues**:
   - Validate JSON syntax
   - Check for duplicate entries
   - Verify file paths are correct

For more help, join our Discord or open an issue on GitHub.