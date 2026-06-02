describe('CLI argument parsing', () => {
  const originalArgv = process.argv;
  let exitSpy;
  let logSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('all flags provided', () => {
    const { parseArgs } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
      '--args',
      '["1"]',
      '--network',
      'mainnet',
      '--token',
      'tok',
    ];

    expect(parseArgs()).toEqual({
      file: 'contracts/My.sol',
      contract: 'My',
      owner: '0x' + 'a'.repeat(40),
      args: '["1"]',
      network: 'mainnet',
      token: 'tok',
    });
  });

  test('--help flag exits', () => {
    const { parseArgs } = require('../src/cli');
    process.argv = ['node', 'cli.js', '--help'];
    expect(() => parseArgs()).toThrow('process.exit');
  });

  test('-h flag exits', () => {
    const { parseArgs } = require('../src/cli');
    process.argv = ['node', 'cli.js', '-h'];
    expect(() => parseArgs()).toThrow('process.exit');
  });

  test('unknown flags ignored', () => {
    const { parseArgs } = require('../src/cli');
    process.argv = ['node', 'cli.js', '--unknown', 'x'];
    expect(parseArgs()).toEqual({});
  });

  test('missing required flags causes usage and exit', async () => {
    const { main } = require('../src/cli');
    process.argv = ['node', 'cli.js'];

    await expect(main()).rejects.toThrow('process.exit');
  });
});

describe('CLI integration', () => {
  const originalArgv = process.argv;
  let logSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = 0;
    jest.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('successful deploy logs address', async () => {
    jest.doMock('../src/index', () => ({
      deployContract: jest.fn().mockResolvedValue({ address: '0xabc' }),
    }));

    const { runCli } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
    ];

    await runCli();

    expect(logSpy).toHaveBeenCalledWith('Deployed address:', '0xabc');
  });

  test('deployContract throws sets exitCode', async () => {
    jest.doMock('../src/index', () => ({
      deployContract: jest.fn().mockRejectedValue(new Error('boom')),
    }));

    const { runCli } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
    ];

    await runCli();

    expect(process.exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalled();
  });

  test('--network mainnet passed through', async () => {
    const deployContract = jest.fn().mockResolvedValue({ address: '0xabc' });
    jest.doMock('../src/index', () => ({ deployContract }));

    const { runCli } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
      '--network',
      'mainnet',
    ];

    await runCli();

    expect(deployContract).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'mainnet' }),
    );
  });
});

describe('CLI compile step', () => {
  const originalArgv = process.argv;
  let logSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = 0;
    jest.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  function mockSpawnExit(code) {
    return jest.fn(() => ({
      on: (event, handler) => {
        if (event === 'close') handler(code, null);
      },
    }));
  }

  test('foundry env runs forge build before deploy', async () => {
    const spawn = mockSpawnExit(0);
    const deployContract = jest
      .fn()
      .mockResolvedValue({ address: '0xabc' });

    jest.doMock('child_process', () => ({ spawn }));
    jest.doMock('fs', () => ({
      existsSync: (p) => p.endsWith('foundry.toml'),
    }));
    jest.doMock('../src/index', () => ({ deployContract }));

    const { runCli } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
    ];

    await runCli();

    expect(spawn).toHaveBeenCalledWith('forge', ['build'], {
      stdio: 'inherit',
    });
    expect(deployContract).toHaveBeenCalled();
  });

  test('hardhat env runs npx hardhat compile before deploy', async () => {
    const spawn = mockSpawnExit(0);
    const deployContract = jest
      .fn()
      .mockResolvedValue({ address: '0xabc' });

    jest.doMock('child_process', () => ({ spawn }));
    jest.doMock('fs', () => ({
      existsSync: (p) => p.endsWith('hardhat.config.js'),
    }));
    jest.doMock('../src/index', () => ({ deployContract }));

    const { runCli } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
    ];

    await runCli();

    expect(spawn).toHaveBeenCalledWith('npx', ['hardhat', 'compile'], {
      stdio: 'inherit',
    });
    expect(deployContract).toHaveBeenCalled();
  });

  test('compile failure prevents deploy and sets exitCode', async () => {
    const spawn = mockSpawnExit(1);
    const deployContract = jest
      .fn()
      .mockResolvedValue({ address: '0xabc' });

    jest.doMock('child_process', () => ({ spawn }));
    jest.doMock('fs', () => ({
      existsSync: (p) => p.endsWith('foundry.toml'),
    }));
    jest.doMock('../src/index', () => ({ deployContract }));

    const { runCli } = require('../src/cli');
    process.argv = [
      'node',
      'cli.js',
      '--file',
      'contracts/My.sol',
      '--contract',
      'My',
      '--owner',
      '0x' + 'a'.repeat(40),
    ];

    await runCli();

    expect(deployContract).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalled();
  });
});
