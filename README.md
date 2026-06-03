# toronetdeploy

Deploy smart contracts to ToroNet.

## Install

Library install:

```bash
npm install toronetdeploy
```

Run via `npx` (no global install required):

```bash
npx toronetdeploy --file contracts/MyToken.sol --contract MyToken \
	--owner 0xYourOwnerAddress --args '["0xabc...", "1000"]' --network testnet
```

## Library Usage

CommonJS:

```js
const { deployContract } = require('toronetdeploy');

async function run() {
  const { address, abi } = await deployContract({
    file: 'contracts/MyToken.sol',
    contract: 'MyToken',
    owner: '0xYourOwnerAddress',
    args: ['0xabc...', '1000'],
    network: 'testnet',
  });

  console.log('Deployed at:', address);
  console.log('ABI:', abi);
}

run().catch(console.error);
```

ESM:

```js
import { deployContract } from 'toronetdeploy';

const { address, abi } = await deployContract({
  file: 'contracts/MyToken.sol',
  contract: 'MyToken',
  owner: '0xYourOwnerAddress',
  args: ['0xabc...', '1000'],
  network: 'testnet',
});

console.log('Deployed at:', address);
console.log('ABI:', abi);
```

## CLI Usage Options

- `--file` Path to the Solidity file containing the contract
- `--contract` Name of the contract to deploy (must be in the specified file)
- `--owner` Address of the owner deploying the contract
- `--args` Constructor arguments as JSON array or comma-separated values
- `--network` Network to deploy to (default: `testnet`)
- `--skip-dump` Skip writing the deployment dump file (default `false`)
- `--token` Optional token for deployment

## Deployment Metadata Dumps

Each successful deployment writes a JSON dump under `deployments/` with two
files per run:

```
deployments/<chainId>-<contractName>-<unix_timestamp>.json
deployments/<chainId>-<contractName>-latest.json
```

The dump records deployment inputs, the deployed address/ABI, and (when
available) Foundry artifact metadata and source files for verification. Dumps
are only written after `deploySmartContract()` succeeds.

License: MIT

Author: [Emmanuel Nwafor](https://github.com/emmo00)
