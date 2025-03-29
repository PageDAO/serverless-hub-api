# PageDAO Hub Governance

## Overview

The PageDAO Hub serves as a showcase for decentralized content across multiple blockchains. As an open-source project, we've designed it to be easily extendable and community-maintained.

This document outlines the governance process for managing the PageDAO Hub registry, particularly the process for adding new collections to the showcase.

## Registry Structure

The contract registry is organized by blockchain, with each chain having its own JSON file:

- `contracts/ethereum.json`
- `contracts/base.json`
- `contracts/optimism.json`
- `contracts/polygon.json`
- `contracts/zora.json`

Each file contains an array of collection objects with the following structure:

```json
{
  "address": "0x1234...",             // Contract address
  "name": "Collection Name",          // Display name
  "type": "book",                     // Content type (book, publication, nft, etc.)
  "contentType": "novel",             // Subcategory
  "creator": "Creator Name",          // Original creator
  "description": "Description...",    // Brief description
  "image": "https://...",             // Cover image URL
  "url": "https://...",               // Website or marketplace URL
  "featured": true                    // Whether to feature in showcase (optional)
}
```

## Governance Process

### 1. Collection Proposal

To propose a new collection for inclusion in the PageDAO Hub registry:

1. **Fork the Repository**: Create a fork of the PageDAO Hub repository
2. **Create a Branch**: Make a new branch for your proposal (e.g., `add-collection-xyz`)
3. **Update Registry**: Add your collection to the appropriate chain's JSON file
4. **Submit Pull Request**: Open a PR with a clear description of the collection

Your PR description should include:
- Collection name and contract address
- Creator information
- Links to verify the collection (marketplace, website, etc.)
- Explanation of why this collection should be included
- Any relevant community affiliations

### 2. Review Process

All collection proposals go through a multi-stage review:

1. **Technical Review**:
   - Verify contract address and functionality
   - Ensure the collection can be accessed via the PageDAO Hub API
   - Check for any security concerns

2. **Content Review**:
   - Assess the quality and relevance of the content
   - Verify creator attribution
   - Check for potential copyright issues

3. **Community Discussion**:
   - PR will remain open for community comments for at least 7 days
   - Community members can vote with 👍/👎 reactions

### 3. Governance Voting

For collections passing the initial review:

1. **Snapshot Proposal**: A formal vote will be created on Snapshot
2. **Voting Period**: 5 days for community members to vote
3. **Approval Threshold**: 
   - Requires majority approval (>50% of votes)
   - Minimum quorum of 100,000 $PAGE tokens voting

### 4. Implementation

Upon successful approval:

1. PR is merged by maintainers
2. Collection is added to the registry
3. Announcement is made in community channels

### 5. Registry Maintenance

The registry is maintained through ongoing governance:

1. **Removal Proposals**: Collections may be proposed for removal if they:
   - Contain illegal or harmful content
   - Are no longer functional or accessible
   - Were misrepresented in the original proposal

2. **Featured Collections**: The `featured` flag is governed separately:
   - Only 5 collections per chain can be featured at once
   - Featured status rotates quarterly
   - Community votes on which collections to feature

## Technical Requirements

Collections must meet these requirements to be included:

1. **Technical Compatibility**: 
   - Must be accessible via the supported content adapters
   - Contract must be verifiable on-chain

2. **Content Requirements**:
   - Must be original or properly licensed
   - Creator must be verifiable
   - Content should be accessible via web3 protocols

3. **Activity Requirements**:
   - Must have had activity in the past 6 months
   - Must be maintained and accessible

## Future Governance Enhancements

We plan to implement these governance improvements:

1. **On-Chain Voting**: Move from Snapshot to fully on-chain voting
2. **Registry DAO**: Dedicated subDAO for registry maintenance
3. **Automated Verification**: Technical checks run automatically on PRs
4. **Curator Roles**: Specialized roles for content curation

## Getting Help

If you need assistance with the proposal process:

- Join our Discord: [https://discord.gg/pagedao](https://discord.gg/pagedao)
- Ask in the #governance channel
- Reach out to existing contributors

We welcome all thoughtful proposals that expand the showcase of decentralized content!