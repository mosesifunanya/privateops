# PrivateOps

## Privacy Preserving Authorization and Verification for AI Agents

PrivateOps is a privacy preserving authorization system built on Midnight. It allows AI agents and applications to prove that an action follows a private policy without exposing the policy itself.

> Verify what AI agents are allowed to do, without exposing private rules.

## Problem

AI agents are increasingly being trusted to perform actions involving sensitive information and valuable resources.

Traditional authorization systems often require applications to reveal or store the rules used to make an authorization decision.

For example, an organization may have a private rule that an AI agent can approve expenses up to a certain limit.

The application should be able to prove that an action was authorized without publicly revealing that private limit.

## Solution

PrivateOps uses Midnight's privacy preserving smart contract capabilities to separate:

1. Public authorization results
2. Private authorization policies

For example:

```text
Private Policy Limit: 500
Action Amount:        300
Authorization Result: AUTHORIZED
```

The action amount and authorization result can be disclosed while the policy limit remains private.

If the action exceeds the private policy:

```text
Private Policy Limit: 500
Action Amount:        700
Authorization Result: NOT AUTHORIZED
```

The private policy itself does not need to be stored as public blockchain state.

## Core Idea

PrivateOps demonstrates a simple privacy preserving authorization workflow:

```text
User Policy
     |
     v
Private Witness
     |
     v
PrivateOps Compact Contract
     |
     v
Zero Knowledge Proof
     |
     v
Authorization Decision
     |
     v
Public Result
```

The private policy is supplied through a local witness.

The smart contract verifies the relationship between the private policy and the requested action while only disclosing the intended public result.

## Architecture

```text
+-----------------------------+
|        User / Agent         |
+--------------+--------------+
               |
               | Action Request
               v
+-----------------------------+
|       PrivateOps CLI        |
+--------------+--------------+
               |
               | Private Policy
               v
+-----------------------------+
|       Local Witness         |
|                             |
|   getPolicyLimit()          |
+--------------+--------------+
               |
               v
+-----------------------------+
|    PrivateOps Compact       |
|        Contract             |
|                             |
| actionAmount <= policyLimit |
+--------------+--------------+
               |
               v
+-----------------------------+
|      Zero Knowledge         |
|          Proof              |
+--------------+--------------+
               |
               v
+-----------------------------+
| Public Authorization Result |
|                             |
| AUTHORIZED / NOT AUTHORIZED |
+-----------------------------+
```

## Privacy Model

PrivateOps currently uses the following model:

### Private

The authorization policy limit is provided through a witness:

```text
getPolicyLimit()
```

The policy limit is not stored as a public ledger value.

### Public

The contract exposes:

```text
lastActionAmount
lastActionAuthorized
```

This means the current action amount and resulting authorization status are intentionally disclosed.

This design demonstrates the basic concept while keeping the underlying authorization rule private.

## Smart Contract

The core contract is located at:

```text
contracts/privateops.compact
```

The contract maintains two public ledger values:

```compact
export ledger lastActionAmount: Uint<64>;
export ledger lastActionAuthorized: Boolean;
```

The private policy is supplied through a witness:

```compact
witness getPolicyLimit(): Uint<64>;
```

The main authorization circuit is:

```compact
export circuit authorizeAction(actionAmount: Uint<64>): [] {
    const policyLimit = getPolicyLimit();

    const authorized = actionAmount <= policyLimit;

    lastActionAmount = disclose(actionAmount);
    lastActionAuthorized = disclose(authorized);
}
```

The important privacy boundary is that `policyLimit` is obtained privately through the witness rather than being stored in public ledger state.

## Technology Stack

| Technology | Purpose |
|---|---|
| Midnight Network | Privacy preserving blockchain |
| Compact | Smart contract language |
| Compact Runtime | Contract execution and witness integration |
| TypeScript | Application and CLI logic |
| Node.js | Development runtime |
| Docker | Proof server environment |
| Midnight JS | Deployment and blockchain integration |
| WSL2 Ubuntu | Development environment |

## Project Structure

```text
privateops/
├── contracts/
│   ├── privateops.compact
│   └── managed/
│       └── privateops/
├── scripts/
│   ├── clean.mjs
│   └── e2e-check.ts
├── src/
│   ├── check-balance.ts
│   ├── cli.ts
│   ├── deploy.ts
│   ├── network.ts
│   ├── setup.ts
│   ├── wallet-state.ts
│   ├── wallet.ts
│   └── witnesses.ts
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

## Getting Started

### Requirements

Before running PrivateOps, install:

- Node.js 22+
- npm
- Docker Desktop
- WSL2 on Windows
- Midnight Compact CLI
- Compact compiler

### Clone the Repository

```bash
git clone <your-repository-url>
cd privateops
```

### Install Dependencies

```bash
npm install
```

## Compile the Contract

Compile the PrivateOps Compact contract with:

```bash
npm run compile
```

The generated contract artifacts are written to:

```text
contracts/managed/privateops/
```

A successful compilation includes the `authorizeAction` circuit.

## Start the Proof Server

Start the required local services with:

```bash
npm run proof-server:start
```

Stop the services with:

```bash
npm run proof-server:stop
```

## Select the Midnight Network

PrivateOps supports the configured Midnight environments.

To select Preview:

```bash
npm run network -- --network preview
```

The current project was deployed and tested on Midnight Preview.

## Setup

Run:

```bash
npm run setup
```

This prepares the local environment and required Midnight services.

## Deployment

Deploy PrivateOps with:

```bash
npm run deploy
```

The deployment process prepares the wallet, proof environment, required network configuration, and contract deployment.

Deployment information is stored locally in:

```text
.midnight-state.json
```

Wallet synchronization state is stored locally in:

```text
.midnight-wallet-state/
```

These files are intentionally ignored by Git because they contain local deployment and wallet state.

## Preview Deployment

PrivateOps has been successfully deployed to Midnight Preview.

### Contract Address

```text
e3836a466cf5ee97443fc970d36fddda4fff407707250c9778e723cbbc2d04de
```

Network:

```text
Midnight Preview
```

The contract address above represents the deployed PrivateOps contract used during Level 1 testing.

## CLI

Start the PrivateOps command line interface with:

```bash
npm run cli
```

The CLI provides:

```text
1. Authorize an action
2. Read current authorization result
3. Check wallet balance
4. Show contract address
5. Exit
```

## Authorization Testing

The authorization circuit has been tested with different action amounts using a private policy limit of `500`.

### Authorized Action

Input:

```text
Policy Limit: 500
Action Amount: 300
```

Result:

```text
Authorized: YES
```

Transaction ID:

```text
00ee309cbf52fc4b615d6c4010361b812655c1d25a90e2f08cd0b1a0fdc0de5a6e
```

Block height:

```text
968014
```

### Unauthorized Action

Input:

```text
Policy Limit: 500
Action Amount: 700
```

Result:

```text
Authorized: NO
```

Transaction ID:

```text
000925b77d3d2d46b3c7e932f6e44e9bf2b2ef6b74ea92ae7977af73784480fa0d
```

Block height:

```text
968026
```

These tests demonstrate that the same private authorization policy can produce different public authorization results depending on the requested action.

## End to End Verification

PrivateOps includes an end to end verification script:

```bash
npm run test:e2e
```

The test verifies the deployed contract and reconnects to the configured Midnight network.

A successful run reports:

```text
e2e-check passed
contractAddress: e3836a466cf5ee97443fc970d36fddda4fff407707250c9778e723cbbc2d04de
network: preview
privateStateId: privateOpsPrivateState
```

## Development Commands

Compile the Compact contract:

```bash
npm run compile
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Start the proof server:

```bash
npm run proof-server:start
```

Stop the proof server:

```bash
npm run proof-server:stop
```

Select Preview:

```bash
npm run network -- --network preview
```

Run setup:

```bash
npm run setup
```

Deploy:

```bash
npm run deploy
```

Run the CLI:

```bash
npm run cli
```

Check wallet balance:

```bash
npm run check-balance
```

Run end to end verification:

```bash
npm run test:e2e
```

Clean generated contract artifacts:

```bash
npm run clean
```

## Security Considerations

PrivateOps is currently an experimental Level 1 implementation.

The current version demonstrates the privacy preserving authorization concept and should not be treated as production authorization infrastructure.

Important considerations include:

- Testnet wallets should not contain real funds.
- Private keys and recovery phrases must never be committed to Git.
- Local wallet state must remain private.
- Authorization policies should be carefully designed before production use.
- Contract logic should undergo security review before handling valuable assets.
- The current implementation intentionally discloses the action amount and authorization result.

## Current Level 1 Status

PrivateOps has completed the core Level 1 implementation:

- Compact contract created
- Private witness implemented
- Authorization circuit implemented
- Contract compilation successful
- Managed contract artifacts generated
- Proof server configured
- Midnight Preview environment configured
- Contract deployed to Preview
- Deployment address recorded
- Authorized transaction tested
- Unauthorized transaction tested
- End to end verification passed
- Project documentation prepared

## Roadmap

### Level 2

Introduce a user interface for interacting with PrivateOps.

Planned capabilities include:

- Wallet connection
- Policy configuration
- Action authorization interface
- Authorization history
- Contract interaction from the browser

### Level 3

Introduce AI agent identity and policy management.

Potential capabilities include:

- Agent registration
- Agent specific policies
- Policy based permissions
- Action categories
- Authorization workflows

### Level 4

Expand the system to Midnight Preprod and improve the application architecture.

Potential work includes:

- More comprehensive testing
- Better privacy workflows
- Improved state management
- Production style frontend
- Agent authorization services

### Level 5

Prepare PrivateOps for broader ecosystem usage.

Potential areas include:

- Developer SDK
- API integrations
- Policy templates
- Agent tooling
- Monitoring
- Better user experience

### Level 6

Prepare the system for Midnight Mainnet deployment.

The long term goal is to make PrivateOps a practical privacy preserving authorization layer for AI agents and automated applications.

## Future Use Cases

PrivateOps can potentially be extended to privacy preserving authorization scenarios such as:

### AI Spending Authorization

An AI agent requests permission to make a payment while the user's private spending limit remains undisclosed.

### Enterprise Agent Permissions

Organizations can define private policies controlling what AI agents are allowed to execute.

### Automated Treasury Operations

Treasury agents can prove that transactions follow predefined private authorization rules.

### Private API Authorization

An agent can prove that an API request satisfies a private policy without revealing the complete policy.

### Autonomous Agents

AI agents can operate within verifiable boundaries while keeping sensitive business rules private.

## Vision

AI agents are becoming capable of making decisions and executing actions on behalf of users and organizations.

PrivateOps explores a future where those agents do not need to reveal every rule they operate under.

Instead, an agent can provide cryptographic evidence that an action followed an authorized private policy.

The goal is simple:

> Prove the action was allowed without revealing the rule.

## Contributing

Contributions are welcome.

Potential contribution areas include:

- Compact smart contract development
- Privacy and zero knowledge design
- Midnight integration
- TypeScript development
- Frontend development
- AI agent integration
- Testing
- Security
- Documentation
- Developer tooling

For significant changes, please open an issue first to discuss the proposed change.

## Author

Moses Ifunanya Nobei

Blockchain Developer | Full Stack Developer 

## License

This project is licensed under the MIT License.

## Project Status

PrivateOps is an active experimental project being developed as part of the Midnight ecosystem challenge.

The current implementation focuses on demonstrating the core privacy preserving authorization concept and establishing the foundation for future levels of development.
