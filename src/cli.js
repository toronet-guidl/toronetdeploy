#!/usr/bin/env node
const { deployContract } = require('./index');

function usage() {
  console.log(
    'Usage:\n\tnpx toronetdeploy --file <path> --contract <name> --owner <address> [--args <json|csv>] [--network testnet|mainnet] [--token <token>]\n\n\
    Options:\n\t--file: Path to Solidity file containing the contract\n\t--contract: Name of the contract to deploy (must be in the specified file)\n\t--owner: Address of the owner deploying the contract\n\t--args: Constructor arguments as JSON array or comma-separated values\n\t--network: Network to deploy to (default: testnet)\n\t--token: Optional token for deployment if required by your setup\n\t--help, -h: Show this help message',
  );
  process.exit(1);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--contract') out.contract = argv[++i];
    else if (a === '--owner') out.owner = argv[++i];
    else if (a === '--network') out.network = argv[++i];
    else if (a === '--token') out.token = argv[++i];
    else if (a === '--args') out.args = argv[++i];
    else if (a === '--help' || a === '-h') usage();
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  if (!opts.file || !opts.contract || !opts.owner) usage();

  console.log('Compiling', opts.file, 'contract', opts.contract);
  console.log('Network:', opts.network || 'testnet');

  const { address } = await deployContract({
    file: opts.file,
    contract: opts.contract,
    owner: opts.owner,
    args: opts.args,
    network: opts.network,
    token: opts.token,
  });

  console.log('Deployed address:', address);
}

function runCli() {
  return main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

if (require.main === module) {
  runCli();
}

module.exports = { parseArgs, usage, main, runCli };
