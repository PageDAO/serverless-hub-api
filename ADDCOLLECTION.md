# Adding a Collection to PageDAO Hub

This guide provides step-by-step instructions for adding a new collection to the PageDAO Hub showcase.

## Quick Start

1. Identify the collection you want to add
2. Determine which blockchain it's on
3. Find out which adapter type it uses (book, publication, nft, etc.)
4. Add an entry to the appropriate chain's JSON file
5. Test locally to ensure it works
6. Submit a proposal through the governance process

## Detailed Steps

### 1. Identify Collection Information

Gather the following information about your collection:

- **Contract Address**: The blockchain address of the collection contract
- **Collection Name**: The official name of the collection
- **Type**: The adapter type to use (see Supported Types below)
- **Content Type**: What kind of content it contains (novel, blog, anthology, etc.)
- **Creator**: Who created the content
- **Description**: A brief description of the collection
- **Image URL**: A representative image (cover, logo, etc.)
- **Website URL**: Where users can learn more or access the content

### 2. Create Registry Entry

Add an entry to the appropriate chain's JSON file in the `contracts/` directory:

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "name": "My Amazing Collection",
  "type": "book",
  "contentType": "novel",
  "creator": "Author Name",
  "description": "A groundbreaking collection of decentralized literature",
  "image": "https://example.com/collection-image.png",
  "url": "https://example.com/collection",
  "featured": false
}
```

### 3. Test Locally

Test the collection in your local environment:

```bash
# Start local development server
npm run dev

# Test the collections endpoint
curl http://localhost:8888/api/collections

# Test your specific collection
curl http://localhost:8888/api/collections/0x1234567890abcdef1234567890abcdef12345678
```

Verify that:
- The collection appears in the list
- Detailed information is accessible
- Collection items can be retrieved

### 4. Submit for Inclusion

Follow the governance process outlined in [GOVERNANCE.md](GOVERNANCE.md) to submit your collection for inclusion.

## Supported Types

PageDAO Hub supports these collection types:

| Type           | Description                             | Example                                        |
|----------------|-----------------------------------------|------------------------------------------------|
| `book`         | Alexandria Books on Base                | Books published through Alexandria Labs        |
| `publication`  | Mirror.xyz and similar publications     | Essays, articles, and blogs on Mirror.xyz      |
| `zora_nft`     | Zora NFT collections                    | Collections published on Zora                   |
| `readme_book`  | Readme Books on Polygon                 | Books published through Readme                 |
| `nft`          | Generic NFT collections                 | General NFT collections with content           |

## Testing Collection Compatibility

If you're unsure which adapter type to use, you can test compatibility with this script:

```javascript
const { ContentTrackerFactory } = require('@pagedao/core');

async function testCompatibility(address, chain) {
  const contentTypes = ContentTrackerFactory.getRegisteredTypes();
  
  console.log(`Testing ${address} on ${chain} with all content types...`);
  
  for (const type of contentTypes) {
    try {
      console.log(`Trying ${type}...`);
      const tracker = ContentTrackerFactory.getTracker(address, type, chain);
      const info = await tracker.getCollectionInfo();
      console.log(`✅ Success with ${type}!`);
      console.log(info);
      return type;
    } catch (error) {
      console.log(`❌ Failed with ${type}: ${error.message}`);
    }
  }
  
  console.log('No compatible adapter found');
  return null;
}

// Example usage
testCompatibility('0x1234567890abcdef1234567890abcdef12345678', 'ethereum')
  .then(type => console.log(`Recommended type: ${type}`))
  .catch(console.error);
```

## Common Issues

### Collection Not Appearing

1. Check that the contract address is correct and in the right format
2. Verify that the adapter type is appropriate for this collection
3. Ensure the blockchain RPC endpoint is working
4. Check the console logs for specific errors

### Metadata Not Loading

1. Verify that the collection implements standard metadata interfaces
2. Check that any IPFS gateways or external links are accessible
3. Try with a different token ID if the current one is problematic

### Authorization Issues

Some collections may require special access or authentication. Contact the collection maintainers to ensure public access is available.

## Getting Help

If you encounter issues or need assistance:

- Join our Discord: [https://discord.gg/pagedao](https://discord.gg/pagedao)
- Ask in the #collections channel
- Check existing collections for examples of working configurations

## Next Steps

After your collection is added:

1. Consider creating a rich description for the collection's page
2. Provide additional metadata for better discovery
3. Help spread the word about your collection through PageDAO channels
4. Consider applying for featured status in the next curation cycle