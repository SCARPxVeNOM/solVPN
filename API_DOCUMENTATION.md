# solVPN API Documentation

Complete API reference for services, smart contracts, and SDK.

---

## Table of Contents

1. [Attestor Service API](#attestor-service-api)
2. [Node Operator WebSocket](#node-operator-websocket)
3. [Smart Contract Instructions](#smart-contract-instructions)
4. [SDK Reference](#sdk-reference)
5. [Frontend Integration](#frontend-integration)

---

## Attestor Service API

Base URL: `http://localhost:8787` (development)

### 1. Get All Nodes

Fetch all registered VPN nodes from the blockchain.

**Endpoint:** `GET /nodes`

**Response:**
```json
{
  "ok": true,
  "nodes": [
    {
      "pubkey": "NodePDA...",
      "operator": "OperatorPubkey...",
      "bandwidthMbps": 100,
      "stakeLamports": 1000000000,
      "totalBytesRelayed": 1048576,
      "reputationScore": 100
    }
  ]
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:8787/nodes');
const { nodes } = await response.json();
console.log('Available nodes:', nodes.length);
```

---

### 2. Record Usage

Submit bandwidth usage from node operator.

**Endpoint:** `POST /record-usage`

**Request Body:**
```json
{
  "operator": "OperatorPubkey...",
  "bytes": 1048576,
  "activeSessions": 3,
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Usage recorded",
  "totalBytes": 1048576
}
```

**Example:**
```typescript
await fetch('http://localhost:8787/record-usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operator: operatorPubkey,
    bytes: 1000000,
    activeSessions: 2,
    timestamp: Date.now()
  })
});
```

---

### 3. Build Start Session Transaction

Generate an unsigned transaction to start a VPN session.

**Endpoint:** `POST /start-session-tx`

**Request Body:**
```json
{
  "user": "UserPubkey...",
  "node": "NodePDA...",
  "depositAmount": 1000000
}
```

**Response:**
```json
{
  "ok": true,
  "tx": "base64EncodedTransaction..."
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:8787/start-session-tx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user: userWallet.publicKey.toBase58(),
    node: selectedNode.id,
    depositAmount: 1_000_000 // 1 DVPN (6 decimals)
  })
});

const { tx } = await response.json();

// Sign with Phantom
const txBuffer = Buffer.from(tx, 'base64');
const signed = await phantom.signAndSendTransaction({
  message: txBuffer
});
```

---

### 4. Build Settle Session Transaction

Generate an unsigned transaction to settle and close a session.

**Endpoint:** `POST /settle-session-tx`

**Request Body:**
```json
{
  "user": "UserPubkey...",
  "node": "NodePDA..."
}
```

**Response:**
```json
{
  "ok": true,
  "tx": "base64EncodedTransaction..."
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:8787/settle-session-tx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user: userWallet.publicKey.toBase58(),
    node: selectedNode.id
  })
});

const { tx } = await response.json();
const signed = await phantom.signAndSendTransaction({
  message: Buffer.from(tx, 'base64')
});
```

---

## Node Operator WebSocket

WebSocket URL: `ws://localhost:3001`

### Connection

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected to VPN node');
};
```

### Messages from Server

#### 1. Welcome Message
Sent immediately after connection.

```json
{
  "type": "welcome",
  "message": "Connected to solVPN node",
  "operator": "OperatorPubkey...",
  "timestamp": 1234567890
}
```

#### 2. Heartbeat
Sent every 30 seconds to keep connection alive.

```json
{
  "type": "heartbeat",
  "timestamp": 1234567890,
  "serverLoad": 5
}
```

#### 3. VPN Response
Echoed data (simulated VPN traffic).

```
VPN_RESPONSE: <your_data>
```

### Messages to Server

Send any binary or text data:

```javascript
ws.send('Test VPN traffic');
ws.send(new Uint8Array([1, 2, 3, 4]));
```

**Bandwidth Tracking:**
- Every byte sent/received is tracked
- Node operator aggregates and reports to attestor every 10 seconds
- Frontend updates bandwidth monitor in real-time

---

## Smart Contract Instructions

Program ID: `8j3TUcbSuaq5BVNSf5GJhgucwrswH432sqJNxCoym8hB`

### 1. Initialize State

Initialize the global program state.

**Instruction:** `initialize_state`

**Accounts:**
```rust
pub struct InitializeState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + State::SIZE,
        seeds = [b"state", authority.key().as_ref()],
        bump
    )]
    pub state: Account<'info, State>,
    
    pub dvpn_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}
```

**Parameters:**
- `bump: u8` - PDA bump seed
- `reward_rate_bps: u16` - Reward rate in basis points

**Events:**
```rust
StateInitialized {
    authority: Pubkey,
    attestor: Pubkey,
    mint: Pubkey
}
```

---

### 2. Register Node

Register a new VPN node operator.

**Instruction:** `register_node`

**Accounts:**
```rust
pub struct RegisterNode<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    
    #[account(seeds = [b"state", operator.key().as_ref()], bump)]
    pub state: Account<'info, State>,
    
    #[account(
        init,
        payer = operator,
        space = 8 + Node::SIZE,
        seeds = [b"node", operator.key().as_ref()],
        bump
    )]
    pub node: Account<'info, Node>,
    
    pub system_program: Program<'info, System>,
}
```

**Parameters:**
- `stake_lamports: u64` - SOL stake amount
- `bandwidth_mbps: u32` - Advertised bandwidth
- `meta_hash: [u8; 32]` - Metadata hash (IP, location, etc.)

**Events:**
```rust
NodeRegistered {
    node: Pubkey,
    operator: Pubkey,
    bandwidth_mbps: u32
}
```

---

### 3. Start Session

Start a new VPN session with token deposit.

**Instruction:** `start_session`

**Accounts:**
```rust
pub struct StartSession<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub node: Account<'info, Node>,
    
    #[account(
        init,
        payer = user,
        space = 8 + Session::SIZE,
        seeds = [b"escrow", user.key().as_ref(), node.key().as_ref()],
        bump
    )]
    pub session: Account<'info, Session>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

**Parameters:**
- `deposit_amount: u64` - Token deposit (in lamports)

**Events:**
```rust
SessionStarted {
    session: Pubkey,
    user: Pubkey,
    node: Pubkey,
    deposit: u64
}
```

---

### 4. Submit Usage

Submit bandwidth usage for a session (attestor only).

**Instruction:** `submit_usage`

**Accounts:**
```rust
pub struct SubmitUsage<'info> {
    pub attestor: Signer<'info>,
    
    #[account(
        seeds = [b"state", attestor.key().as_ref()],
        bump,
        constraint = state.attestor == attestor.key()
    )]
    pub state: Account<'info, State>,
    
    #[account(mut)]
    pub session: Account<'info, Session>,
}
```

**Parameters:**
- `bytes: u64` - Bytes transferred

**Events:**
```rust
UsageSubmitted {
    session: Pubkey,
    bytes: u64
}
```

**Security:**
- Only the attestor can call this
- Session must not be closed
- Overflow checks enabled

---

### 5. Settle Session

Close session and transfer tokens to node operator.

**Instruction:** `settle_session`

**Accounts:**
```rust
pub struct SettleSession<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub node: Account<'info, Node>,
    
    #[account(
        mut,
        seeds = [b"escrow", user.key().as_ref(), node.key().as_ref()],
        bump = session.bump
    )]
    pub session: Account<'info, Session>,
    
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub node_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
```

**Parameters:** None

**Events:**
```rust
SessionSettled {
    session: Pubkey,
    payout: u64,
    bytes: u64
}
```

**Payment Calculation:**
```rust
let price_per_mb = node.bandwidth_mbps as u64;
let payout = (session.bytes_used / 1_048_576) * price_per_mb;
let protocol_fee = payout / 100; // 1%
let node_amount = payout - protocol_fee;
```

---

## SDK Reference

Package: `@solvpn/sdk`

### DvpnClient

Main SDK class for interacting with the program.

#### Constructor

```typescript
import { DvpnClient } from "@solvpn/sdk";
import { AnchorProvider } from "@coral-xyz/anchor";

const provider = AnchorProvider.env();
const client = new DvpnClient(provider);
```

#### Methods

##### statePda(authority: PublicKey): [PublicKey, number]

Derive the State PDA for an authority.

```typescript
const [statePda, bump] = client.statePda(authorityPubkey);
```

##### nodePda(operator: PublicKey): [PublicKey, number]

Derive the Node PDA for an operator.

```typescript
const [nodePda, bump] = client.nodePda(operatorPubkey);
```

##### sessionPda(user: PublicKey, node: PublicKey): [PublicKey, number]

Derive the Session PDA for a user-node pair.

```typescript
const [sessionPda, bump] = client.sessionPda(userPubkey, nodePubkey);
```

##### initializeState(args): Promise<void>

Initialize the program state.

```typescript
await client.initializeState({
  authority: authorityPubkey,
  mint: dvpnMintPubkey,
  rewardRateBps: 100
});
```

##### registerNode(args, operator): Promise<void>

Register a new node operator.

```typescript
await client.registerNode({
  stakeLamports: 1_000_000_000n,
  bandwidthMbps: 100,
  metaHash: new Uint8Array(32)
}, operatorPubkey);
```

##### startSession(args): Promise<void>

Start a VPN session.

```typescript
await client.startSession({
  user: userPubkey,
  nodeOperator: operatorPubkey,
  depositAmount: 1_000_000,
  userTokenAccount: userAtaPubkey,
  escrowTokenAccount: escrowAtaPubkey
});
```

##### submitUsage(args): Promise<void>

Submit usage (attestor only).

```typescript
await client.submitUsage({
  attestor: attestorPubkey,
  user: userPubkey,
  nodeOperator: operatorPubkey,
  bytes: 1048576
});
```

##### settleSession(args): Promise<void>

Settle and close a session.

```typescript
await client.settleSession({
  user: userPubkey,
  nodeOperator: operatorPubkey,
  escrowTokenAccount: escrowAtaPubkey,
  nodeTokenAccount: nodeAtaPubkey
});
```

##### fetchState(authority): Promise<State>

Fetch state account data.

```typescript
const state = await client.fetchState(authorityPubkey);
console.log('Attestor:', state.attestor);
```

##### fetchNode(operator): Promise<Node>

Fetch node account data.

```typescript
const node = await client.fetchNode(operatorPubkey);
console.log('Bandwidth:', node.bandwidthMbps);
```

##### fetchSession(user, nodeOperator): Promise<Session | null>

Fetch session account data.

```typescript
const session = await client.fetchSession(userPubkey, operatorPubkey);
if (session) {
  console.log('Bytes used:', session.bytesUsed);
  console.log('Closed:', session.closed);
}
```

---

## Frontend Integration

### Setup

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import {
  SOLANA_RPC,
  ATTESTOR_URL,
  fetchAllNodes,
  fetchSession,
  getNodePda,
  getSessionPda
} from "../lib/solana";
```

### Connect Phantom Wallet

```typescript
const [phantom, setPhantom] = useState<any>(null);

useEffect(() => {
  if (window.solana?.isPhantom) {
    setPhantom(window.solana);
  }
}, []);

const connectWallet = async () => {
  const resp = await phantom.connect();
  console.log('Connected:', resp.publicKey.toString());
};
```

### Fetch Nodes

```typescript
const loadNodes = async () => {
  const response = await fetch(`${ATTESTOR_URL}/nodes`);
  const data = await response.json();
  
  if (data.ok && data.nodes) {
    setNodes(data.nodes);
  }
};
```

### Start Session

```typescript
const startSession = async () => {
  const response = await fetch(`${ATTESTOR_URL}/start-session-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: walletAddress,
      node: selectedNode.id,
      depositAmount: 1_000_000
    })
  });

  const { tx } = await response.json();
  const txBuffer = Buffer.from(tx, 'base64');
  
  const signed = await phantom.signAndSendTransaction({
    message: txBuffer
  });
  
  console.log('Session started:', signed.signature);
};
```

### Connect to VPN

```typescript
const connectVPN = () => {
  const ws = new WebSocket('ws://localhost:3001');
  
  ws.onopen = () => {
    console.log('VPN connected');
  };
  
  ws.onmessage = (event) => {
    const bytes = event.data.length;
    setBytesTransferred(prev => prev + bytes);
  };
  
  setWebsocket(ws);
};
```

### Settle Session

```typescript
const settleSession = async () => {
  const response = await fetch(`${ATTESTOR_URL}/settle-session-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: walletAddress,
      node: selectedNode.id
    })
  });

  const { tx } = await response.json();
  const signed = await phantom.signAndSendTransaction({
    message: Buffer.from(tx, 'base64')
  });
  
  console.log('Session settled:', signed.signature);
  
  // Close WebSocket
  if (websocket) {
    websocket.close();
  }
};
```

---

## Error Codes

### Smart Contract Errors

```rust
pub enum DvpnError {
    #[msg("Unauthorized action")]
    Unauthorized,
    
    #[msg("Session already closed")]
    SessionClosed,
    
    #[msg("Math overflow")]
    MathOverflow,
}
```

### HTTP Error Responses

```json
{
  "ok": false,
  "error": "Error message here"
}
```

---

## Rate Limits

- **Attestor API:** No limits (development)
- **Node Operator WebSocket:** No limits (development)

**Production Recommendations:**
- Attestor: 100 req/min per IP
- WebSocket: 10 connections per IP

---

## Security Considerations

1. **Never expose private keys** in frontend code
2. **Always validate signatures** on backend
3. **Use HTTPS** in production
4. **Implement rate limiting** on all endpoints
5. **Sanitize all inputs** to prevent injection
6. **Use versioned transactions** for larger payloads
7. **Monitor for anomalous behavior** (unusual byte counts)

---

## Support

For API issues or questions:
- GitHub Issues: https://github.com/SCARPxVeNOM/test22
- Documentation: README.md
- Testing Guide: TESTING_GUIDE.md

---

**Built with ❤️ on Solana**

