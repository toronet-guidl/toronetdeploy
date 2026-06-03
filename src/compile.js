const fs = require('fs');
const path = require('path');
const solc = require('solc');

function compileSolidity(filePath, contractName) {
  console.log(`Compiling ${contractName} from ${filePath}...`);
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath))
    throw new Error('Solidity file not found: ' + absPath);
  const source = fs.readFileSync(absPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [path.basename(absPath)]: { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] },
      },
    },
  };

  // load remappings from lib/*/remappings.txt (common in Foundry projects)
  function loadRemappings() {
    const remaps = [];
    const projectRoot = process.cwd();

    // 1) read foundry.toml remappings if present
    const foundryFile = path.join(projectRoot, 'foundry.toml');
    if (fs.existsSync(foundryFile)) {
      try {
        const txt = fs.readFileSync(foundryFile, 'utf8');
        const m = txt.match(/remappings\s*=\s*\[([^\]]*)\]/m);
        if (m && m[1]) {
          const items = m[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          for (let it of items) {
            // remove quotes and whitespace
            it = it.trim().replace(/^["']|["']$/g, '');
            // expect format prefix=target
            const parts = it.split('=');
            if (parts.length !== 2) continue;
            const prefix = parts[0];
            const target = parts[1];
            const absTarget = path.resolve(projectRoot, target);
            remaps.push([prefix, absTarget]);
          }
        }
        if (remaps.length === 0) {
          console.warn(
            'Warning: foundry.toml found but no remappings parsed from it',
          );
        }
      } catch (e) {
        // ignore parsing errors
      }
    }

    // 2) read lib/*/remappings.txt (foundry style)
    const libDir = path.resolve(projectRoot, 'lib');
    if (fs.existsSync(libDir)) {
      const libs = fs
        .readdirSync(libDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const l of libs) {
        const rfile = path.join(libDir, l, 'remappings.txt');
        if (!fs.existsSync(rfile)) continue;
        const lines = fs
          .readFileSync(rfile, 'utf8')
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const line of lines) {
          const parts = line.split('=');
          if (parts.length !== 2) continue;
          const prefix = parts[0];
          const target = parts[1];
          // make target absolute relative to remappings.txt
          const absTarget = path.resolve(path.dirname(rfile), target);
          remaps.push([prefix, absTarget]);
        }
      }
    }

    return remaps;
  }

  const remappings = loadRemappings();

  const mainDir = path.dirname(absPath);

  function findImports(importPath) {
    // Try remappings first (e.g. @openzeppelin/...)
    for (let [prefix, targetDir] of remappings) {
      // normalize prefix by removing trailing slash
      const normalizedPrefix = prefix.endsWith('/')
        ? prefix.slice(0, -1)
        : prefix;
      // match exact prefix or prefix + '/'
      if (
        importPath === normalizedPrefix ||
        importPath.startsWith(normalizedPrefix + '/')
      ) {
        const rest =
          importPath === normalizedPrefix
            ? ''
            : importPath.slice(normalizedPrefix.length + 1);
        const candidate = path.join(targetDir, rest);
        if (fs.existsSync(candidate))
          return { contents: fs.readFileSync(candidate, 'utf8') };
      }
    }

    // node_modules fallback
    const nmCandidate = path.join(process.cwd(), 'node_modules', importPath);
    if (fs.existsSync(nmCandidate))
      return { contents: fs.readFileSync(nmCandidate, 'utf8') };

    // relative to main file
    const relCandidate = path.resolve(mainDir, importPath);
    if (fs.existsSync(relCandidate))
      return { contents: fs.readFileSync(relCandidate, 'utf8') };

    // absolute / project-root relative
    const rootCandidate = path.resolve(process.cwd(), importPath);
    if (fs.existsSync(rootCandidate))
      return { contents: fs.readFileSync(rootCandidate, 'utf8') };

    return { error: 'File import callback not supported for ' + importPath };
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );
  if (output.errors) {
    console.log('Compilation output had errors/warnings:');
    const hasFatal = output.errors.some((e) => e.severity === 'error');
    output.errors.forEach(
      (e) => console.error(e),
    );
    if (hasFatal) throw new Error('Compilation failed with errors');
  }

  const primaryKey = path.basename(absPath);
  let contract = output.contracts[primaryKey]?.[contractName];

  if (!contract) {
    // Search all compiled files for the contract name
    const matches = [];
    for (const [file, contracts] of Object.entries(output.contracts || {})) {
      if (contracts[contractName]) matches.push(file);
    }
    if (matches.length === 1) {
      console.warn(
        `Warning: contract ${contractName} found in ${matches[0]}, not in the primary file`,
      );
      contract = output.contracts[matches[0]][contractName];
    } else if (matches.length > 1) {
      throw new Error(
        `Ambiguous contract name "${contractName}" found in multiple files: ${matches.join(
          ', ',
        )}. Rename to disambiguate.`,
      );
    } else {
      throw new Error(
        `Contract ${contractName} not found in ${filePath} or any imported file`,
      );
    }
  }

  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;
  if (!bytecode || bytecode.length === 0)
    throw new Error('Bytecode is empty (abstract contract or interface?)');

  // Check for unlinked library references
  const unlinked = bytecode.match(/__\$[a-f0-9]+\$__/g);
  if (unlinked) {
    const unique = [...new Set(unlinked)];
    throw new Error(
      `Bytecode contains unlinked library references: ${unique.join(', ')}. ` +
        `You must link these libraries before deploying.`,
    );
  }

  return { abi, bytecode: '0x' + bytecode };
}

module.exports = { compileSolidity };
