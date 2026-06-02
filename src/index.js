const { compileSolidity } = require('./compile');
const { parseConstructorArgs } = require('./args');
const { initializeSDK, deploySmartContract } = require('torosdk');

function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * @typedef {Object} DeployContractOptions
 * @property {string} file - Path to the .sol file
 * @property {string} contract - Contract name to deploy
 * @property {string} owner - Owner wallet address
 * @property {Array|string} [args] - Constructor args (array or JSON/CSV string)
 * @property {'testnet'|'mainnet'} [network] - Defaults to 'testnet'
 * @property {string} [token] - Optional auth token
 */

/**
 * Compiles and deploys a Solidity contract.
 * @param {DeployContractOptions} opts
 * @returns {Promise<{ address: string, abi: Array }>}
 */
async function deployContract(opts = {}) {
  const { file, contract, owner, network = 'testnet', token } = opts;

  if (!file) throw new Error('deployContract: `file` is required');
  if (!contract) throw new Error('deployContract: `contract` is required');
  if (!owner) throw new Error('deployContract: `owner` is required');
  if (!isValidAddress(owner)) {
    throw new Error(
      'deployContract: `owner` must be a valid Toronet address (0x + 40 hex chars)',
    );
  }

  const constructorArgs = Array.isArray(opts.args)
    ? opts.args
    : parseConstructorArgs(opts.args);

  const { abi, bytecode } = compileSolidity(file, contract);

  try {
    initializeSDK({ network });
  } catch (err) {
    throw new Error(`SDK initialization failed: ${err?.message ?? err}`);
  }

  const result = await deploySmartContract({
    owner,
    constructorArgs,
    abi,
    bytecode,
    token,
    network,
  });

  return { address: result.address, abi };
}

module.exports = { deployContract };
