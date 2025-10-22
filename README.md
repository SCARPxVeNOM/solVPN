## solVPN — Decentralized VPN on Solana (Devnet)

This repository is a monorepo for a privacy-focused, low-latency decentralized VPN (dVPN) built on Solana Devnet. It includes:

- Anchor smart program `dvpn` for node registry, usage accounting, and rewards
- TypeScript SDK for client interactions
- Frontend (Next.js) and services (node operator, attestor) — to be added next
- Circom circuits for zero-knowledge session proofs — to be added next

### Quick Start

1) Prerequisites

- Rust + Cargo, Solana CLI, Anchor CLI
- Node.js LTS + npm
- PowerShell (Windows) or bash (macOS/Linux)

2) Configure Solana for Devnet

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
```

3) Initialize DVPN SPL Mint and set program PDA as mint authority

```powershell
scripts/setup-devnet.ps1
```

4) Build and deploy the Anchor program

```powershell
scripts/deploy.ps1
```

5) Use the SDK

```ts
import { DvpnClient } from "./sdk";
```

### Repository Structure

```
programs/
  dvpn/              # Anchor program
sdk/                 # TypeScript client SDK
apps/                # Web UI (Next.js) — upcoming
services/            # Node operator + attestor — upcoming
circuits/            # Circom circuits — upcoming
scripts/             # Devnet helper scripts
```

### Security Notes

- The program uses a PDA mint authority; ensure you transfer SPL mint authority to the PDA shown by `scripts/setup-devnet.ps1` before allowing real claims.
- Staking/vault flows are simplified for the initial sprint; do not use in production without audits and full escrow mechanics.


