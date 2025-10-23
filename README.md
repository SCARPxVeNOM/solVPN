# 🌐 solVPN — Decentralized VPN on Solana

<div align="center">

[![CI](https://github.com/SCARPxVeNOM/test22/actions/workflows/ci.yml/badge.svg)](https://github.com/SCARPxVeNOM/test22/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)

A **production-grade decentralized VPN platform** built on Solana with:
- 🔐 **SPL Token Payments** with CPI escrow settlements
- 🌐 **P2P Node Operator Network**
- ⚡ **Real-time Session Management**
- 🛡️ **Zero-Knowledge Bandwidth Proofs** (Circom)
- 🎨 **Next.js Frontend** with Phantom wallet integration
- 🐳 **Docker** + **CI/CD** ready

[Demo](#-quickstart) • [Architecture](#-architecture) • [Deployment](#-deployment) • [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quickstart](#-quickstart)
- [Repository Structure](#-repository-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Security](#-security)
- [Contributing](#-contributing)

---

## ✨ Features

### Smart Contract (Anchor on Solana)
- ✅ **Node Registration** with SOL staking
- ✅ **Session Management** with escrow deposits
- ✅ **Usage Tracking** by attestor service
- ✅ **Automatic Settlements** with SPL token CPI transfers
- ✅ **Rewards System** with configurable rates
- ✅ **Protocol Fees** (1% on settlements)

### Services
- 🔒 **Attestor Service** - Verifies bandwidth usage with ZK proofs
- 🖥️ **Node Operator** - Manages VPN nodes and relays
- 📊 **Indexer** - Tracks on-chain events (optional)

### Frontend
- 💳 **Phantom Wallet** integration
- 📱 **Session Dashboard** - Start/stop VPN sessions
- 📈 **Usage Monitoring** - Real-time bandwidth tracking
- 🎨 **Modern UI** with Tailwind CSS

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Web Frontend  │ (Next.js + Phantom)
└────────┬────────┘
         │
    ┌────▼────┐
    │ Attestor │ (Verifies proofs)
    └────┬────┘
         │
┌────────▼─────────────────────┐
│  Solana Program (Anchor)     │
│  • Node Registry             │
│  • Session Management        │
│  • SPL Token Settlements     │
└──────────────────────────────┘
         │
    ┌────▼────┐
    │  Nodes  │ (VPN relay operators)
    └─────────┘
```

---

## 🚀 Quickstart

### Prerequisites

- **Rust** 1.70+ ([install](https://rustup.rs/))
- **Solana CLI** 1.17+ ([install](https://docs.solana.com/cli/install-solana-cli-tools))
- **Anchor CLI** 0.30+ ([install](https://www.anchor-lang.com/docs/installation))
- **Node.js** 18+ and **npm**
- **Docker** (optional, for containerized deployment)

### 1️⃣ Clone and Setup

```bash
git clone https://github.com/SCARPxVeNOM/test22.git
cd test22

# Copy environment template
cp env.example .env
```

### 2️⃣ Configure Solana Devnet

```bash
solana config set --url https://api.devnet.solana.com
solana-keygen new --outfile ~/.config/solana/id.json  # if you don't have one
solana airdrop 2
```

### 3️⃣ Create SPL Token (DVPN Mint)

```bash
# Create token mint
spl-token create-token --decimals 9

# Save the mint address to .env as DVPN_MINT_ADDRESS
# Create associated token account for your wallet
spl-token create-account <MINT_ADDRESS>

# Mint initial supply for testing
spl-token mint <MINT_ADDRESS> 1000000000
```

### 4️⃣ Build & Deploy Anchor Program

```bash
cd programs/dvpn
anchor build
anchor deploy

# Copy the program ID to Anchor.toml and .env
```

### 5️⃣ Initialize Program State

```bash
# Run initialization script (creates state PDA and sets mint authority)
cd ../../scripts
./setup-devnet.ps1  # Windows
# or
bash setup-devnet.sh  # macOS/Linux
```

### 6️⃣ Start Services

**Option A: Docker Compose (Recommended)**

```bash
docker-compose up --build
```

**Option B: Manual**

```bash
# Terminal 1: Attestor
cd services/attestor
npm install
npm run dev

# Terminal 2: Node Operator
cd services/node-operator
npm install
npm run dev

# Terminal 3: Frontend
cd apps/web
npm install
npm run dev
```

### 7️⃣ Open Demo

Navigate to **http://localhost:3000** and connect your Phantom wallet!

---

## 📁 Repository Structure

```
test22/
├── programs/
│   └── dvpn/               # Anchor smart contract
│       ├── src/lib.rs      # Main program logic
│       └── Cargo.toml
├── sdk/                    # TypeScript SDK
│   ├── src/
│   │   ├── index.ts        # Client library
│   │   └── idl/dvpn.json   # Program IDL
│   └── examples/           # Usage examples
├── services/
│   ├── attestor/           # Bandwidth verification service
│   ├── node-operator/      # VPN node manager
│   └── indexer/            # Event indexer (optional)
├── apps/
│   └── web/                # Next.js frontend
│       ├── pages/
│       └── components/
├── circuits/               # Circom ZK circuits
│   ├── session.circom
│   └── compile.sh
├── scripts/                # Deployment scripts
├── docker-compose.yml      # Container orchestration
└── .github/
    └── workflows/ci.yml    # GitHub Actions CI
```

---

## 🔧 Development

### Build Everything

```bash
npm run build
```

### Run Tests

```bash
# Anchor tests
cd programs/dvpn
anchor test

# SDK tests
cd ../../sdk
npm test

# Frontend tests
cd ../apps/web
npm test
```

### Format Code

```bash
# Rust
cargo fmt --all

# TypeScript
npm run format
```

---

## 🚀 Deployment

### Devnet Deployment

1. Ensure `.env` is configured with:
   - `SOLANA_RPC_URL=https://api.devnet.solana.com`
   - `PROGRAM_ID=<your_deployed_program_id>`
   - `DVPN_MINT_ADDRESS=<your_token_mint>`
   - `ATTESTOR_SECRET_KEY=<secret_key_array>`

2. Run deployment:

```bash
./scripts/deploy.ps1  # Windows
# or
bash scripts/deploy.sh  # Linux/macOS
```

### Mainnet Deployment (Production)

⚠️ **NOT READY FOR MAINNET** - This is a devnet prototype. Before mainnet:

- [ ] Complete security audit
- [ ] Add multisig authority
- [ ] Implement timelocks
- [ ] Add comprehensive tests
- [ ] Set up monitoring & alerts

---

## 🧪 Testing

### Local Validator

```bash
solana-test-validator --reset
```

### Run Full Test Suite

```bash
anchor test --skip-local-validator
```

### Manual Testing Flow

1. Register a node: `POST /register-tx` (attestor service)
2. Sign transaction with wallet
3. Start session via frontend
4. Submit usage: `POST /record-usage`
5. Settle session and verify token transfer

---

## 🔐 Security

### Current Security Model

- ✅ PDA-based escrow for session deposits
- ✅ Attestor-only usage submission
- ✅ Overflow protection in all calculations
- ✅ Closed session guards
- ⚠️ Simplified pricing model (bandwidth_mbps as price)
- ⚠️ No timelock on settlements

### Recommendations for Production

1. **Add Timelocks** - Prevent instant settlement abuse
2. **Implement Slashing** - Penalize malicious nodes
3. **Multi-sig Authority** - Decentralize program control
4. **Rate Limiting** - Prevent spam attacks
5. **Comprehensive Audits** - Full security review

### Reporting Vulnerabilities

Please email security@yourproject.com or open a private security advisory.

---

## 🎯 Roadmap

- [x] Core Anchor program with session management
- [x] SPL token CPI settlements
- [x] Attestor service with ZK proof verification
- [x] Frontend with Phantom wallet
- [x] Docker deployment
- [ ] Mainnet-ready security hardening
- [ ] DAO governance for protocol parameters
- [ ] Mobile app (iOS/Android)
- [ ] Token2022 migration with extensions

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Solana Foundation](https://solana.com)
- [Anchor Framework](https://anchor-lang.com)
- [Circom ZK toolkit](https://docs.circom.io)
- Colosseum Hackathon participants

---

<div align="center">

**Built with ❤️ by the solVPN team**

[Twitter](https://twitter.com/solvpn) • [Discord](https://discord.gg/solvpn) • [Docs](https://docs.solvpn.io)

</div>

