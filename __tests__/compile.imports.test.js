const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('solc', () => ({
  compile: jest.fn(),
}));

const solc = require('solc');
const { compileSolidity } = require('../src/compile');

function setupTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'torodeploy-imports-'));
  const contractsDir = path.join(dir, 'contracts');
  fs.mkdirSync(contractsDir, { recursive: true });
  const filePath = path.join(contractsDir, 'Main.sol');
  fs.writeFileSync(filePath, 'contract Main {}', 'utf8');
  return {
    dir,
    filePath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function makeOutput(filePath, contractName) {
  const key = path.basename(filePath);
  return JSON.stringify({
    contracts: {
      [key]: {
        [contractName]: {
          abi: [],
          evm: { bytecode: { object: '00' } },
        },
      },
    },
  });
}

describe('compileSolidity import resolution', () => {
  let cwd;
  let temp;

  beforeEach(() => {
    cwd = process.cwd();
    temp = setupTempProject();
    process.chdir(temp.dir);
    solc.compile.mockReset();
  });

  afterEach(() => {
    process.chdir(cwd);
    temp.cleanup();
  });

  test('remapping from foundry.toml (single-line)', () => {
    const foundry = 'remappings = ["@oz/=lib/openzeppelin-contracts/"]';
    fs.writeFileSync(path.join(temp.dir, 'foundry.toml'), foundry, 'utf8');

    const target = path.join(
      temp.dir,
      'lib',
      'openzeppelin-contracts',
      'token',
      'ERC20',
    );
    fs.mkdirSync(target, { recursive: true });
    const importFile = path.join(target, 'ERC20.sol');
    fs.writeFileSync(importFile, 'ERC20', 'utf8');

    solc.compile.mockImplementation((input, options) => {
      const result = options.import('@oz/token/ERC20/ERC20.sol');
      expect(result.contents).toBe('ERC20');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('remapping from foundry.toml (multiline)', () => {
    const foundry = [
      'remappings = [',
      '  "@a/=lib/a/",',
      '  "@b/=lib/b/"',
      ']',
    ].join('\n');
    fs.writeFileSync(path.join(temp.dir, 'foundry.toml'), foundry, 'utf8');

    const aDir = path.join(temp.dir, 'lib', 'a');
    const bDir = path.join(temp.dir, 'lib', 'b');
    fs.mkdirSync(aDir, { recursive: true });
    fs.mkdirSync(bDir, { recursive: true });
    fs.writeFileSync(path.join(aDir, 'A.sol'), 'A', 'utf8');
    fs.writeFileSync(path.join(bDir, 'B.sol'), 'B', 'utf8');

    solc.compile.mockImplementation((input, options) => {
      expect(options.import('@a/A.sol').contents).toBe('A');
      expect(options.import('@b/B.sol').contents).toBe('B');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('remapping with trailing slash on prefix', () => {
    const foundry = 'remappings = ["foo/=lib/foo/"]';
    fs.writeFileSync(path.join(temp.dir, 'foundry.toml'), foundry, 'utf8');

    const target = path.join(temp.dir, 'lib', 'foo');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'Bar.sol'), 'BAR', 'utf8');

    solc.compile.mockImplementation((input, options) => {
      const result = options.import('foo/Bar.sol');
      expect(result.contents).toBe('BAR');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('remapping from lib/*/remappings.txt', () => {
    const libDir = path.join(temp.dir, 'lib', 'pkg');
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(path.join(libDir, 'remappings.txt'), 'bar/=src/', 'utf8');

    const target = path.join(libDir, 'src');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'Bar.sol'), 'BARLIB', 'utf8');

    solc.compile.mockImplementation((input, options) => {
      const result = options.import('bar/Bar.sol');
      expect(result.contents).toBe('BARLIB');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('falls back to node_modules', () => {
    const nmDir = path.join(temp.dir, 'node_modules', 'baz');
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, 'Baz.sol'), 'BAZ', 'utf8');

    solc.compile.mockImplementation((input, options) => {
      const result = options.import('baz/Baz.sol');
      expect(result.contents).toBe('BAZ');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('falls back to relative path', () => {
    fs.writeFileSync(
      path.join(path.dirname(temp.filePath), 'Rel.sol'),
      'REL',
      'utf8',
    );

    solc.compile.mockImplementation((input, options) => {
      const result = options.import('Rel.sol');
      expect(result.contents).toBe('REL');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('falls back to project root', () => {
    fs.writeFileSync(path.join(temp.dir, 'Root.sol'), 'ROOT', 'utf8');

    solc.compile.mockImplementation((input, options) => {
      const result = options.import('Root.sol');
      expect(result.contents).toBe('ROOT');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });

  test('import not found anywhere returns error', () => {
    solc.compile.mockImplementation((input, options) => {
      const result = options.import('missing/No.sol');
      expect(result.error).toContain('File import callback not supported');
      return makeOutput(temp.filePath, 'Main');
    });

    compileSolidity(temp.filePath, 'Main');
  });
});
