jest.mock('../src/compile', () => ({
  compileSolidity: jest.fn(),
}));

jest.mock('../src/args', () => ({
  parseConstructorArgs: jest.fn(),
}));

jest.mock('torosdk', () => ({
  initializeSDK: jest.fn(),
  deploySmartContract: jest.fn(),
}));

const { compileSolidity } = require('../src/compile');
const { parseConstructorArgs } = require('../src/args');
const { initializeSDK, deploySmartContract } = require('torosdk');
const { deployContract } = require('../src/index');

describe('deployContract validation', () => {
  beforeEach(() => {
    compileSolidity.mockReset();
    parseConstructorArgs.mockReset();
    initializeSDK.mockReset();
    deploySmartContract.mockReset();
  });

  test('missing file throws', async () => {
    await expect(
      deployContract({ contract: 'C', owner: '0x' + 'a'.repeat(40) }),
    ).rejects.toThrow('file');
  });

  test('missing contract throws', async () => {
    await expect(
      deployContract({ file: 'f.sol', owner: '0x' + 'a'.repeat(40) }),
    ).rejects.toThrow('contract');
  });

  test('missing owner throws', async () => {
    await expect(
      deployContract({ file: 'f.sol', contract: 'C' }),
    ).rejects.toThrow('owner');
  });

  test('invalid owner address format throws', async () => {
    await expect(
      deployContract({ file: 'f.sol', contract: 'C', owner: '0x123' }),
    ).rejects.toThrow('valid Toronet address');
  });

  test('network defaults to testnet', async () => {
    compileSolidity.mockReturnValue({ abi: [], bytecode: '0x00' });
    deploySmartContract.mockResolvedValue({ address: '0xabc' });

    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
      args: [],
    });

    expect(initializeSDK).toHaveBeenCalledWith({ network: 'testnet' });
  });
});

describe('deployContract args handling', () => {
  beforeEach(() => {
    compileSolidity.mockReset();
    parseConstructorArgs.mockReset();
    initializeSDK.mockReset();
    deploySmartContract.mockReset();
    compileSolidity.mockReturnValue({ abi: [], bytecode: '0x00' });
    deploySmartContract.mockResolvedValue({ address: '0xabc' });
  });

  test('args passed as array are used directly', async () => {
    const args = ['a', 1];
    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
      args,
    });

    expect(parseConstructorArgs).not.toHaveBeenCalled();
    expect(deploySmartContract).toHaveBeenCalledWith(
      expect.objectContaining({ constructorArgs: args }),
    );
  });

  test('args passed as JSON string are parsed', async () => {
    parseConstructorArgs.mockReturnValue(['x']);

    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
      args: '["x"]',
    });

    expect(parseConstructorArgs).toHaveBeenCalledWith('["x"]');
    expect(deploySmartContract).toHaveBeenCalledWith(
      expect.objectContaining({ constructorArgs: ['x'] }),
    );
  });

  test('args passed as CSV string are parsed', async () => {
    parseConstructorArgs.mockReturnValue(['a', 2]);

    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
      args: 'a,2',
    });

    expect(parseConstructorArgs).toHaveBeenCalledWith('a,2');
    expect(deploySmartContract).toHaveBeenCalledWith(
      expect.objectContaining({ constructorArgs: ['a', 2] }),
    );
  });

  test('args omitted default to []', async () => {
    parseConstructorArgs.mockReturnValue([]);

    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
    });

    expect(parseConstructorArgs).toHaveBeenCalledWith(undefined);
    expect(deploySmartContract).toHaveBeenCalledWith(
      expect.objectContaining({ constructorArgs: [] }),
    );
  });
});

describe('deployContract SDK interactions', () => {
  beforeEach(() => {
    compileSolidity.mockReset();
    parseConstructorArgs.mockReset();
    initializeSDK.mockReset();
    deploySmartContract.mockReset();
    parseConstructorArgs.mockReturnValue([]);
    compileSolidity.mockReturnValue({ abi: ['abi'], bytecode: '0x00' });
  });

  test('initializeSDK throws', async () => {
    initializeSDK.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(
      deployContract({
        file: 'f.sol',
        contract: 'C',
        owner: '0x' + 'a'.repeat(40),
      }),
    ).rejects.toThrow('SDK initialization failed: boom');
  });

  test('deploySmartContract throws', async () => {
    deploySmartContract.mockRejectedValue(new Error('fail'));

    await expect(
      deployContract({
        file: 'f.sol',
        contract: 'C',
        owner: '0x' + 'a'.repeat(40),
      }),
    ).rejects.toThrow('fail');
  });

  test('happy path returns address and abi', async () => {
    deploySmartContract.mockResolvedValue({ address: '0xabc' });

    await expect(
      deployContract({
        file: 'f.sol',
        contract: 'C',
        owner: '0x' + 'a'.repeat(40),
      }),
    ).resolves.toEqual({ address: '0xabc', abi: ['abi'] });
  });

  test('token is passed through when provided', async () => {
    deploySmartContract.mockResolvedValue({ address: '0xabc' });

    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
      token: 'tok',
    });

    expect(deploySmartContract).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
    );
  });

  test('token is undefined when omitted', async () => {
    deploySmartContract.mockResolvedValue({ address: '0xabc' });

    await deployContract({
      file: 'f.sol',
      contract: 'C',
      owner: '0x' + 'a'.repeat(40),
    });

    expect(deploySmartContract).toHaveBeenCalledWith(
      expect.objectContaining({ token: undefined }),
    );
  });
});
