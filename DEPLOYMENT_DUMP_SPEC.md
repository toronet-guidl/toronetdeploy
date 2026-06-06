# Toronet Deployment Data Dump - Specification

**Format:** JSON
**Produced by:** toronet deployment tool
**Supported chains:** Testnet (chainId: 54321) and Mainnet (chainId: 77777)
**SDK:** torosdk - deploySmartContract

> The tool calls deploySmartContract() directly
> and assembles the dump from the SDK response plus tool-side data.

---

## File Naming Convention

```
deployments/
├── <chainId>-<contractName>-<unix_timestamp>.json   # immutable record per deploy
└── <chainId>-<contractName>-latest.json             # always the most recent run
```

**Examples:**

```
deployments/54321-ToroToken-1700000000.json    # testnet, timestamped
deployments/77777-ToroToken-latest.json        # mainnet, latest pointer
```

---

## Top-Level Schema

```jsonc
{
  "_format": "toronet-deployment-v1",
  "specVersion": "1.0.0",

  "network": "testnet", // "testnet" | "mainnet"
  "chainId": 54321, // 54321 (testnet) | 77777 (mainnet)
  "timestamp": 1700000000, // Unix timestamp (seconds) when the dump was written

  "deployment": {
    /* DeploymentRecord */
  },
}
```

One file per contract deployment. There is no script-level wrapper or
array of transactions - the tool deploys one contract per run.

---

## DeploymentRecord Schema

```jsonc
{
  "contractName": "ToroToken",

  "status": "success", // "success" | "pending" | "failed"
  "error": null, // present only when status is "failed"

  "owner": "0xOwnerAddress",

  "input": {
    "constructorArgs": ["0xArg1", "0xArg2"],
    "bytecode": "0x608060...",
  },

  "contractAddress": "0xDeployedAddress",

  "contractAbi": [
    {
      "type": "constructor",
      "inputs": [
        { "name": "param1", "type": "address", "internalType": "address" },
      ],
      "stateMutability": "nonpayable",
    },
  ],

  "source": {
    "compilerVersion": "0.8.24",
    "evmVersion": "paris",
    "optimizer": {
      "enabled": true,
      "runs": 200,
    },
    "viaIR": false,
    "contractPath": "src/ToroToken.sol",
    "bytecodeHash": "0xabc123...",
    "compilerMetadata": {
      "compiler": { "version": "0.8.24+commit.e11b9ed9" },
      "language": "Solidity",
      "output": { "abi": ["..."], "devdoc": {}, "userdoc": {} },
      "settings": {
        "compilationTarget": { "src/ToroToken.sol": "ToroToken" },
        "evmVersion": "paris",
        "libraries": {},
        "metadata": { "bytecodeHash": "ipfs" },
        "optimizer": { "enabled": true, "runs": 200 },
        "remappings": [],
      },
      "sources": {
        "src/ToroToken.sol": {
          "keccak256": "0xsourcehash...",
          "license": "MIT",
        },
      },
      "version": 1,
    },
    "sources": {
      "src/ToroToken.sol": {
        "isPrimary": true,
        "keccak256": "0xsourcehash...",
        "content": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n...",
      },
    },
  },
}
```

---

## Field Types Reference

| Field                          | Type    | Notes                              |
| ------------------------------ | ------- | ---------------------------------- | ------------ | ------ |
| chainId                        | number  | 54321 or 77777                     |
| timestamp                      | number  | Unix seconds                       |
| contractAddress, owner         | string  | 0x-prefixed Toronet address        |
| contractAbi                    | array   | Standard Solidity ABI JSON         |
| input.constructorArgs          | array   | Values as passed                   |
| input.bytecode                 | string  | 0x-prefixed hex, creation bytecode |
| source.compilerVersion         | string  | e.g. "0.8.24+commit.e11b9ed9"      |
| source.evmVersion              | string  | e.g. "paris"                       |
| source.optimizer.enabled       | boolean |                                    |
| source.optimizer.runs          | number  |                                    |
| source.viaIR                   | boolean |                                    |
| source.contractPath            | string  | Relative to project root           |
| source.bytecodeHash            | string  | 0x-prefixed keccak256 hex          |
| source.compilerMetadata        | object  | Parsed Foundry metadata JSON       |
| source.sources                 | object  | Map keyed by path                  |
| source.sources[path].isPrimary | boolean | true for exactly one entry         |
| source.sources[path].keccak256 | string  | 0x-prefixed hash                   |
| source.sources[path].content   | string  | Raw Solidity source or null        |
| status                         | string  | success                            | pending      | failed |
| error                          | string  | null                               | error string |

---

## Null Field Rules

| Status              | contractAddress | source          | error        |
| ------------------- | --------------- | --------------- | ------------ |
| success             | populated       | fully populated | null         |
| pending             | populated       | fully populated | null         |
| failed (pre-submit) | null            | populated       | error string |
| failed (revert)     | populated       | fully populated | error string |

---

## Notes

- Source fields are tool-side, not SDK-side.
- bytecodeHash is keccak256 of the submitted creation bytecode.
- If a source file cannot be read, set content to null and include an error field.
- Mainnet token must not be dumped.
