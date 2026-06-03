const fs = require('fs');
const path = require('path');
const { keccak256 } = require('ethereum-cryptography/keccak');
const { bytesToHex, hexToBytes } = require('ethereum-cryptography/utils');

const FORMAT = 'toronet-deployment-v1';
const SPEC_VERSION = '1.0.0';

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function computeKeccakHex(bytes) {
  return '0x' + bytesToHex(keccak256(bytes));
}

function hashHexString(hex) {
  if (!hex) return null;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length === 0) return null;
  return '0x' + bytesToHex(keccak256(hexToBytes(clean)));
}

function getChainId(network) {
  return network === 'mainnet' ? 77777 : 54321;
}

function readArtifact(file, contractName) {
  const base = path.basename(file);
  const artifactPath = path.resolve(
    process.cwd(),
    'out',
    base,
    `${contractName}.json`,
  );
  if (!fs.existsSync(artifactPath)) return { artifact: null };
  const raw = fs.readFileSync(artifactPath, 'utf8');
  return { artifact: JSON.parse(raw) };
}

function parseMetadata(artifact) {
  const raw = artifact?.metadata;
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

function getContractPath(metadata) {
  const target = metadata?.settings?.compilationTarget;
  if (!target || typeof target !== 'object') return null;
  const entries = Object.keys(target);
  if (entries.length === 0) return null;
  return normalizePath(entries[0]);
}

function buildSourceMap(metadata, contractPath) {
  const sourcesMeta = metadata?.sources || {};
  const out = {};

  for (const [rawPath, meta] of Object.entries(sourcesMeta)) {
    const relPath = normalizePath(rawPath);
    const absPath = path.resolve(process.cwd(), relPath);
    let content = null;
    let contentHash = null;
    let error;

    try {
      content = fs.readFileSync(absPath, 'utf8');
      contentHash = computeKeccakHex(Buffer.from(content, 'utf8'));
    } catch (err) {
      error = err?.message ?? String(err);
    }

    const metaHash = meta?.keccak256 || null;
    if (!error && metaHash && contentHash && metaHash !== contentHash) {
      error = 'keccak256 mismatch between artifact and local file';
    }

    out[relPath] = {
      isPrimary: relPath === contractPath,
      keccak256: metaHash || contentHash,
      content,
      ...(error ? { error } : {}),
    };
  }

  return out;
}

function buildSourceData(file, contractName, bytecode) {
  const { artifact } = readArtifact(file, contractName);
  if (!artifact) {
    return {
      compilerVersion: null,
      evmVersion: null,
      optimizer: null,
      viaIR: null,
      contractPath: null,
      bytecodeHash: hashHexString(bytecode),
      compilerMetadata: null,
      sources: {},
    };
  }

  const metadata = parseMetadata(artifact);
  const contractPath = metadata ? getContractPath(metadata) : null;

  return {
    compilerVersion: metadata?.compiler?.version ?? null,
    evmVersion: metadata?.settings?.evmVersion ?? null,
    optimizer: metadata?.settings?.optimizer ?? null,
    viaIR: metadata?.settings?.viaIR ?? null,
    contractPath: contractPath ?? null,
    bytecodeHash: hashHexString(bytecode),
    compilerMetadata: metadata ?? null,
    sources: buildSourceMap(metadata, contractPath),
  };
}

function writeDeploymentDump({
  file,
  contractName,
  owner,
  constructorArgs,
  bytecode,
  abi,
  address,
  network,
}) {
  const resolvedNetwork = network === 'mainnet' ? 'mainnet' : 'testnet';
  const chainId = getChainId(resolvedNetwork);
  const timestamp = Math.floor(Date.now() / 1000);

  const deployment = {
    contractName,
    status: 'success',
    error: null,
    owner,
    input: {
      constructorArgs: constructorArgs || [],
      bytecode,
    },
    contractAddress: address,
    contractAbi: abi || [],
    source: buildSourceData(file, contractName, bytecode),
  };

  const dump = {
    _format: FORMAT,
    specVersion: SPEC_VERSION,
    network: resolvedNetwork,
    chainId,
    timestamp,
    deployment,
  };

  const dir = path.resolve(process.cwd(), 'deployments');
  fs.mkdirSync(dir, { recursive: true });

  const baseName = `${chainId}-${contractName}`;
  const timestampedPath = path.join(dir, `${baseName}-${timestamp}.json`);
  const latestPath = path.join(dir, `${baseName}-latest.json`);
  const payload = JSON.stringify(dump, null, 2) + '\n';

  fs.writeFileSync(timestampedPath, payload, 'utf8');
  fs.writeFileSync(latestPath, payload, 'utf8');

  return dump;
}

module.exports = { writeDeploymentDump };
