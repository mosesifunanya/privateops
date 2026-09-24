# PrivateOps

### Privacy-Preserving Authorization on Midnight

PrivateOps is a privacy-preserving authorization dApp built on the Midnight Network.

It allows a user to prove that an action is authorized by a private policy without publicly revealing the private information behind that authorization.

The project demonstrates how Midnight's zero-knowledge architecture can be used to build applications where authorization can be verified while sensitive policy information remains private.

---

## Overview

Many applications need to answer a simple question:

> Is this user allowed to perform this action?

Traditional applications often expose or centrally store the information used to make that decision.

PrivateOps demonstrates a different approach.

The authorization rule can remain private while the user produces a zero-knowledge proof showing that the requested action satisfies the rule.

For example:

```text
Private authorization rule
        |
        | remains private
        v
+------------------------+
|   PrivateOps Circuit   |
+-----------+------------+
            |
            | Zero-Knowledge Proof
            v
     "Action is authorized"
            |
            v
       Midnight Preprod
```

The core idea is:

> Prove that an action is authorized without revealing the private rule used to authorize it.

---

## Key Features

- Midnight Preprod integration
- Privacy-preserving authorization
- Zero-knowledge proof generation
- Browser-based proof generation
- Midnight-compatible wallet connection
- Wallet connect and disconnect
- Connected wallet address display
- Authorization circuit execution
- On-chain transaction submission
- Private state management
- Private inputs never displayed in the UI
- Transaction result display
- Responsive frontend
- Light and dark interface support

---

## Architecture

PrivateOps is divided into several layers.

```text
+-------------------------------------------------------------+
|                           USER                              |
|                                                             |
|             Connect Wallet / Request Action                 |
+-------------------------------+-----------------------------+
                                |
                                v
+-------------------------------------------------------------+
|                     PRIVATEOPS FRONTEND                     |
|                                                             |
|  Next.js / React                                             |
|                                                             |
|  +-------------------+       +---------------------------+  |
|  | WalletConnect     |       | CircuitCall               |  |
|  |                   |       |                           |  |
|  | Wallet state      |       | Authorization request     |  |
|  | Address           |       | Proof status              |  |
|  | Connection        |       | Transaction result        |  |
|  +---------+---------+       +-------------+-------------+  |
+------------|-------------------------------|----------------+
             |                               |
             v                               v
+------------------------+       +-----------------------------+
| Midnight Wallet       |       | Midnight.js Integration     |
|                        |       |                             |
| Connect                |       | Proof provider              |
| Sign / submit          |       | Private state provider      |
| Shielded keys          |       | Public data provider        |
+------------------------+       +--------------+--------------+
                                                |
                                                v
                               +------------------------------+
                               |      PrivateOps Contract     |
                               |                              |
                               |      Compact Circuit        |
                               |                              |
                               |      authorizeAction()       |
                               +--------------+---------------+
                                              |
                                              v
                               +------------------------------+
                               |       Midnight Preprod       |
                               |                              |
                               |  Zero-Knowledge Transaction  |
                               |  Public Ledger Data          |
                               +------------------------------+
```

---

## Authorization Flow

The application follows this flow:

```text
1. User opens PrivateOps
          |
          v
2. User connects Midnight wallet
          |
          v
3. Wallet address becomes available
          |
          v
4. User enters an action amount
          |
          v
5. PrivateOps calls authorizeAction()
          |
          v
6. Private state / private witness is used
          |
          v
7. Zero-knowledge proof is generated
          |
          v
8. Proof is submitted through the wallet
          |
          v
9. Midnight processes the transaction
          |
          v
10. Authorization result is displayed
```

During proof generation the application displays:

> Proved without revealing your input

The private witness is never displayed in the interface.

---

# Privacy Model

## What Is Public

The following information may be visible:

- Midnight Preprod network
- PrivateOps contract address
- Connected wallet address
- Public action amount
- Transaction information
- Public blockchain transaction data

## What Is Private

PrivateOps keeps authorization information used by the circuit private.

This includes the private policy information used to determine whether an action should be authorized.

Private inputs are not displayed in the frontend.

## What Does the User Prove?

The user proves that the requested action satisfies the authorization conditions enforced by the PrivateOps circuit.

The proof allows the authorization to be verified without exposing the private information used to generate that proof.

---

# Privacy Claim

PrivateOps demonstrates the following privacy model:

> An on-chain observer can see the public transaction information and other data intentionally exposed by the application, but cannot directly observe the private witness used by the authorization circuit.

The purpose of the application is not to hide the existence of a transaction.

Instead, it demonstrates how a transaction can carry a verifiable authorization result without exposing the sensitive private information behind that result.

---

# Smart Contract

PrivateOps uses a Compact smart contract containing the authorization circuit.

The primary circuit used by the frontend is:

```text
authorizeAction()
```

The contract is compiled with the required zero-knowledge artifacts used by the frontend proving flow.

The deployed contract is accessed through Midnight's Preprod infrastructure.

---

# Contract Deployment

## Midnight Preprod

| Network | Contract Address |
|---|---|
| Preprod | `0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53` |

### Preprod Contract Address

```text
0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53
```

This is the contract address currently configured for the PrivateOps frontend.

---

## Preview Contract

No separate Preview contract address has been deployed.

The frontend preview environment uses the PrivateOps Preprod contract:

```text
0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53
```

---

# Technology Stack

## Blockchain

- Midnight Network
- Midnight Preprod
- Compact
- Zero-Knowledge Proofs

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Motion
- Lucide React

## Midnight Integration

- Midnight.js
- `@midnight-ntwrk/dapp-connector-api`
- Midnight proving provider
- Midnight indexer
- Midnight private state provider
- Midnight wallet integration

## Development

- Node.js
- npm
- Git
- Docker for local Midnight infrastructure where required

---

# Project Structure

```text
privateops/
|
+-- app/
|   +-- globals.css
|   +-- layout.tsx
|   +-- page.tsx
|   +-- providers.tsx
|
+-- components/
|   +-- ui/
|
+-- contracts/
|   +-- managed/
|
+-- public/
|   +-- contract/
|   |   +-- compiled/
|   |
|   +-- keys/
|   +-- zk/
|   +-- zkir/
|
+-- src/
|   +-- components/
|   |   +-- CircuitCall.tsx
|   |   +-- WalletConnect.tsx
|   |
|   +-- hooks/
|   |   +-- useMidnight.ts
|   |
|   +-- midnight/
|   |   +-- client.ts
|   |
|   +-- shims/
|   |   +-- isomorphic-ws.ts
|   |
|   +-- deploy.ts
|   +-- wallet.ts
|
+-- .gitignore
+-- next.config.mjs
+-- package.json
+-- postcss.config.mjs
+-- tsconfig.json
+-- README.md
```

---

# Frontend Components

## WalletConnect

`WalletConnect.tsx` handles the wallet connection layer.

Responsibilities include:

- Detecting Midnight-compatible wallets
- Showing available wallet options
- Connecting a wallet
- Disconnecting a wallet
- Displaying the connected wallet
- Displaying the wallet address
- Handling connection errors
- Maintaining wallet connection state

---

## CircuitCall

`CircuitCall.tsx` handles the authorization interaction.

Responsibilities include:

- Accepting the public action amount
- Validating the authorization request
- Calling the authorization circuit
- Generating the zero-knowledge proof
- Showing proof-generation status
- Submitting the transaction
- Displaying the transaction result

Private witness information is intentionally excluded from the UI.

---

# Midnight Integration

The Midnight integration is handled through the application layer in:

```text
src/midnight/client.ts
```

The client configures the Midnight environment and connects the frontend to:

- The deployed PrivateOps contract
- Midnight Preprod
- The proving provider
- The private state provider
- The public data provider
- The connected wallet

The application uses the configured contract address:

```text
0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53
```

---

# Private State

PrivateOps uses Midnight private state for the authorization policy.

The private policy is not intended to be public ledger data.

The application interacts with the private state through Midnight's private state provider.

This allows the authorization circuit to access the information required to evaluate an authorization request while keeping that information outside the public interface.

---

# Zero-Knowledge Proof

PrivateOps uses the `authorizeAction` circuit to generate the authorization proof.

The required proving artifacts are included in the application assets.

```text
public/
|
+-- keys/
|   +-- authorizeAction.prover
|   +-- authorizeAction.verifier
|
+-- zkir/
    +-- authorizeAction.bzkir
```

Additional compiled contract artifacts are available under:

```text
public/contract/compiled/
```

The proof generation flow is designed so that private witness information is not displayed to the user.

---

# Running Locally

## Requirements

- Node.js 22+
- npm
- Midnight-compatible wallet
- Midnight Preprod access

## Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd privateops
```

## Install Dependencies

```bash
npm install
```

## Environment Configuration

Create:

```text
.env.local
```

Add:

```env
NEXT_PUBLIC_PRIVATEOPS_CONTRACT_ADDRESS=0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53
```

## Start the Development Server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

# Production Build

Verify the application with:

```bash
npm run build
```

The build should complete without TypeScript or compilation errors.

Start the production application with:

```bash
npm run start
```

---

# Deployment

PrivateOps is designed to be deployed as a Next.js application.

The production environment must contain:

```env
NEXT_PUBLIC_PRIVATEOPS_CONTRACT_ADDRESS=0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53
```

The deployed frontend must connect to the Midnight Preprod contract documented above.

---

# Live Demo

**Pending deployment**

The live deployment URL will be added after the frontend is deployed.

```text
Live URL:
To be added
```

---

# Demo Video

**Pending recording**

The Level 2 demo will show:

1. Opening PrivateOps
2. Connecting a Midnight-compatible wallet
3. Showing the connected wallet address
4. Entering an action amount
5. Starting the authorization circuit
6. Showing the proof-generation/loading state
7. Showing:

   **Proved without revealing your input**

8. Showing the submitted transaction
9. Demonstrating that the private input was never displayed

---

# Level 2 Builder Challenge

PrivateOps extends the Level 1 Midnight project with a frontend application and wallet-connected circuit interaction.

| Requirement | Status |
|---|---|
| Frontend application | Complete |
| Midnight wallet connection | Complete |
| Wallet disconnect | Complete |
| Wallet address display | Complete |
| Midnight Preprod integration | Complete |
| Contract integration | Complete |
| Circuit call from frontend | Complete |
| Local proof generation | Complete |
| On-chain submission | Complete |
| Loading state | Complete |
| Transaction result | Complete |
| Private input hidden | Complete |
| Privacy Claim | Complete |
| Contract address in README | Complete |
| Live deployment | Pending |
| Demo video | Pending |

---

# Security Considerations

PrivateOps is a demonstration application.

Private witness information should not be exposed through the user interface, browser logs, public application state, or other publicly accessible locations.

Environment files and sensitive credentials must never be committed to Git.

Do not commit:

```text
.env
.env.local
wallet seeds
private keys
private credentials
```

The repository should contain only public configuration and the artifacts required by the application.

---

# Project Goal

The goal of PrivateOps is to demonstrate a practical use case for Midnight's privacy-preserving architecture.

Instead of publicly revealing the information behind an authorization decision, PrivateOps demonstrates a model where an application can verify authorization while keeping the underlying private information protected.

The core concept is:

```text
Private information
        |
        v
Authorization circuit
        |
        v
Zero-Knowledge Proof
        |
        v
Verifiable authorization
        |
        v
Midnight Network
```

### PrivateOps

> **Prove authorization without revealing the private rule behind it.**

---

# Current Status

| Component | Status |
|---|---|
| Level 1 Contract | Complete |
| Level 2 Frontend | Complete |
| Wallet Integration | Complete |
| Authorization Circuit | Complete |
| ZK Proof Flow | Complete |
| Preprod Contract | Deployed |
| Production Build | Passing |
| Live Deployment | Pending |
| Demo Video | Pending |

---

# Contract Reference

**Network**

```text
Midnight Preprod
```

**PrivateOps Contract**

```text
0338ff933381e9c7dcd01a88c29c60a28f4da6cc78daca7a49718430d68adb53
```

**Primary Circuit**

```text
authorizeAction()
```

---

# License

This project was created as a Midnight Builder Challenge project and is provided for demonstration and educational purposes.
