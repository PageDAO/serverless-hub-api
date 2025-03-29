/**
 * PageDAO Hub Contract Registry
 * 
 * Central registry that loads collection contracts from each chain's JSON file.
 * This file serves as the main entry point for accessing the showcase collections.
 */

const path = require('path');
const fs = require('fs');

// Helper function to safely load JSON files
function loadJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.warn(`Warning: Could not load ${filename}:`, error.message);
    return [];
  }
}

// Load contract registries for each chain
const contractRegistry = {
  ethereum: loadJsonFile('./ethereum.json'),
  base: loadJsonFile('./base.json'),
  optimism: loadJsonFile('./optimism.json'),
  polygon: loadJsonFile('./polygon.json'),
  zora: loadJsonFile('./zora.json')
};

/**
 * Get contracts for a specific chain or all chains
 * @param {string} chain - Chain name or 'all' for all chains
 * @returns {Array} Array of contract objects
 */
function getContracts(chain = 'all') {
  if (chain === 'all') {
    // Return all contracts from all chains
    return Object.entries(contractRegistry).reduce((allContracts, [chainName, contracts]) => {
      // Add chain name to each contract object
      const contractsWithChain = contracts.map(contract => ({
        ...contract,
        chain: chainName
      }));
      return [...allContracts, ...contractsWithChain];
    }, []);
  } else if (contractRegistry[chain]) {
    // Return contracts for the specified chain
    return contractRegistry[chain].map(contract => ({
      ...contract,
      chain
    }));
  } else {
    console.warn(`Warning: Chain '${chain}' not found in registry`);
    return [];
  }
}

module.exports = {
  getContracts,
  contractRegistry
};