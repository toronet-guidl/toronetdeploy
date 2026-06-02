const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('solc', () => ({
  compile: jest.fn(),
}));

const solc = require('solc');
const { compileSolidity } = require('../src/compile');

function setupTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'torodeploy-'));
  const contractsDir = path.join(dir, 'contracts');
  fs.mkdirSync(contractsDir, { recursive: true });
  const filePath = path.join(contractsDir, 'MyContract.sol');
  fs.writeFileSync(filePath, 'contract MyContract {}', 'utf8');
  return { dir, filePath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function makeOutput(filePath, contractName, bytecode = '00', abi = []) {
  const key = path.basename(filePath);
  return JSON.stringify({
    contracts: {
      [key]: {
        [contractName]: {
          abi,
          evm: { bytecode: { object: bytecode } },
        },
      },
    },
  });
}

describe('compileSolidity file resolution', () => {
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

  test('file not found throws', () => {
    expect(() => compileSolidity('missing.sol', 'Missing')).toThrow('Solidity file not found');
  });

  test('compiler returns fatal error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    solc.compile.mockReturnValue(
      JSON.stringify({ errors: [{ severity: 'error', message: 'fatal' }] })
    );
    expect(() => compileSolidity(temp.filePath, 'MyContract')).toThrow('Compilation failed with errors');
    errorSpy.mockRestore();
  });

  test('compiler returns only warnings', () => {
    solc.compile.mockReturnValue(
      JSON.stringify({
        errors: [{ severity: 'warning', message: 'warn' }],
        contracts: {
          [path.basename(temp.filePath)]: {
            MyContract: { abi: [], evm: { bytecode: { object: '00' } } },
          },
        },
      })
    );

    const result = compileSolidity(temp.filePath, 'MyContract');
    expect(result.bytecode).toBe('0x00');
  });

  test('contract name not found in output', () => {
    solc.compile.mockReturnValue(
      JSON.stringify({
        contracts: {
          [path.basename(temp.filePath)]: {
            Other: { abi: [], evm: { bytecode: { object: '00' } } },
          },
        },
      })
    );

    expect(() => compileSolidity(temp.filePath, 'MyContract')).toThrow(/Contract MyContract not found/);
  });

  test('bytecode is empty string', () => {
    solc.compile.mockReturnValue(makeOutput(temp.filePath, 'MyContract', ''));
    expect(() => compileSolidity(temp.filePath, 'MyContract')).toThrow('Bytecode is empty');
  });

  test('happy path returns abi and 0x-prefixed bytecode', () => {
    solc.compile.mockReturnValue(makeOutput(temp.filePath, 'MyContract', 'abc123', ['abi']));
    const result = compileSolidity(temp.filePath, 'MyContract');
    expect(result).toEqual({ abi: ['abi'], bytecode: '0xabc123' });
  });
});

describe('compileSolidity unlinked library detection', () => {
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

  test('bytecode with placeholders throws', () => {
    solc.compile.mockReturnValue(makeOutput(temp.filePath, 'MyContract', '__$abcdef$__'));
    expect(() => compileSolidity(temp.filePath, 'MyContract')).toThrow('unlinked library references');
  });

  test('bytecode with multiple placeholders lists all', () => {
    solc.compile.mockReturnValue(
      makeOutput(temp.filePath, 'MyContract', '__$abcdef$____$123456$__')
    );
    try {
      compileSolidity(temp.filePath, 'MyContract');
    } catch (err) {
      expect(err.message).toContain('__$abcdef$__');
      expect(err.message).toContain('__$123456$__');
    }
  });

  test('clean bytecode passes', () => {
    solc.compile.mockReturnValue(makeOutput(temp.filePath, 'MyContract', '00'));
    const result = compileSolidity(temp.filePath, 'MyContract');
    expect(result.bytecode).toBe('0x00');
  });
});
