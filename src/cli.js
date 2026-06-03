#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { deployContract } = require('./index');

const isWindows = process.platform === 'win32';

function detectEnvironment(cwd = process.cwd()) {
  const foundryPath = path.join(cwd, 'foundry.toml');
  const hardhatConfigs = [
    'hardhat.config.js',
    'hardhat.config.ts',
    'hardhat.config.cjs',
    'hardhat.config.mjs',
  ];

  const hasFoundry = fs.existsSync(foundryPath);
  const hasHardhat = hardhatConfigs.some((name) =>
    fs.existsSync(path.join(cwd, name)),
  );

  if (hasFoundry) return 'foundry';
  if (hasHardhat) return 'hardhat';
  return null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    child.on('error', (err) => reject(err));
    child.on('close', (code, signal) => {
      if (code === 0) return resolve();
      const suffix = signal ? ` (signal ${signal})` : ` (exit ${code})`;
      reject(
        new Error(`Command failed: ${command} ${args.join(' ')}${suffix}`),
      );
    });
  });
}

async function runCompileIfNeeded() {
  const env = detectEnvironment();
  if (env === 'foundry') {
    console.log('Detected Foundry project. Running forge build...');
    await runCommand('forge', ['build']);
  } else if (env === 'hardhat') {
    console.log('Detected Hardhat project. Running npx hardhat compile...');
    await runCommand(isWindows ? 'npx.cmd' : 'npx', ['hardhat', 'compile']);
  }
}

function usage() {
  console.log(
    'Usage:\n\tnpx toronetdeploy --file <path> --contract <name> --owner <address> [--args <json|csv>] [--network testnet|mainnet] [--token <token>] [--skip-dump]\n\n\
    Options:\n\t--file: Path to Solidity file containing the contract\n\t--contract: Name of the contract to deploy (must be in the specified file)\n\t--owner: Address of the owner deploying the contract\n\t--args: Constructor arguments as JSON array or comma-separated values\n\t--network: Network to deploy to (default: testnet)\n\t--token: Optional token for deployment if required by your setup\n\t--skip-dump: Skip writing the deployment dump file\n\t--help, -h: Show this help message',
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
    else if (a === '--skip-dump') out.skipDump = true;
    else if (a === '-v' || a === '--version') {
      const pkg = require('../package.json');
      console.log(`toronetdeploy version ${pkg.version}`);
      process.exit(0);
    } else if (a === '--help' || a === '-h') usage();
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  if (!opts.file || !opts.contract || !opts.owner) usage();

  console.log('Compiling', opts.file, 'contract', opts.contract);
  console.log('Network:', opts.network || 'testnet');

  await runCompileIfNeeded();

  const { address } = await deployContract({
    file: opts.file,
    contract: opts.contract,
    owner: opts.owner,
    args: opts.args,
    network: opts.network,
    token: opts.token,
    skipDump: opts.skipDump || false,
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

module.exports = {
  parseArgs,
  usage,
  main,
  runCli,
  detectEnvironment,
  runCompileIfNeeded,
  runCommand,
};
