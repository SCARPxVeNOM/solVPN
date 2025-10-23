# solVPN Testing Guide

Complete end-to-end testing guide for the decentralized VPN on Solana.

## Prerequisites

1. **Phantom Wallet** installed in your browser with devnet SOL
2. **Node.js** v18+ and npm installed
3. **Solana CLI** installed and configured for devnet
4. **DVPN tokens** in your wallet (airdrop or mint)

## Quick Start Testing

### 1. Start All Services

```powershell
# In PowerShell, run:
.\start-all-services.ps1
```

This will open 3 terminal windows:
- **Attestor Service** (port 8787)
- **Node Operator** (port 3001 WebSocket)
- **Web Frontend** (port 3000)

### 2. Access the VPN Client

1. Open browser: http://localhost:3000
2. Click "🌐 Open VPN Client"
3. Connect your Phantom wallet

## End-to-End Testing Flow

### Phase 1: Wallet Connection ✅

**Expected Behavior:**
- Phantom wallet prompt appears
- After connection, see your SOL balance
- DVPN token balance loads (if you have any)

**Troubleshooting:**
- If balance shows 0 SOL, get devnet SOL: https://faucet.solana.com
- Ensure Phantom is on devnet (Settings → Developer Settings)

---

### Phase 2: Server Selection ✅

**Expected Behavior:**
- Server list loads from blockchain (via attestor)
- Servers show:
  - Country flags and cities
  - Real-time load percentage
  - Bandwidth capacity
  - Online status
- Interactive map displays server locations

**What to Test:**
1. Click different servers in the list
2. Map highlights should update
3. Selected server appears in connection card

**Troubleshooting:**
- If no servers appear: Check attestor logs for `/nodes` endpoint
- Verify node operator registered on-chain

---

### Phase 3: Start VPN Session ✅

**What Happens:**
1. Click the large "CONNECT" button
2. VPN page calls attestor: `POST /start-session-tx`
3. Attestor builds unsigned transaction
4. Phantom prompts for signature
5. Transaction creates Session PDA on-chain
6. Tokens transfer from wallet → escrow PDA
7. WebSocket connects to node operator (port 3001)

**Expected Behavior:**
- Loading spinner appears
- Phantom transaction prompt
- Success notification: "Session started! Connecting to VPN..."
- Button changes to "DISCONNECT" (red)
- Status badge: "🟢 Protected"
- Bandwidth monitor starts showing activity

**What to Test:**
```javascript
// In browser console, simulate VPN traffic:
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
  console.log('Connected to VPN');
  // Send test data
  ws.send('Test VPN traffic');
  ws.send('More data transfer');
};
ws.onmessage = (e) => console.log('Received:', e.data);
```

**On-Chain Verification:**
```powershell
# Check session account exists
solana account <SESSION_PDA> --url devnet

# Expected output:
# - Balance > 0 (rent exempt)
# - Owner: Your program ID
# - Data length: ~105 bytes
```

**Troubleshooting:**
- **"Please select a server!"** → Select a server first
- **"Please connect wallet!"** → Connect Phantom
- **"Transaction failed"** → Check attestor logs for errors
- **WebSocket connection failed** → Ensure node operator is running

---

### Phase 4: Monitor Bandwidth ✅

**Expected Behavior:**
- **Download/Upload speeds** update in real-time
- **Progress bars** animate based on throughput
- **Total Data** increments (in MB/GB)
- **Duration** timer counts up (HH:MM:SS)

**What to Test:**
1. Send data through WebSocket (see Phase 3 code)
2. Watch bandwidth monitor update
3. Check node operator terminal logs:
   ```
   📊 Client: +X bytes (total: Y)
   ```
4. Every 10 seconds, node reports to attestor:
   ```
   📤 Reporting X bytes to attestor...
   ✅ Attestor response: { ok: true }
   ```

**On-Chain Verification:**
```javascript
// In browser console:
const session = await fetchSession(connection, userPubkey, nodePubkey);
console.log('Bytes used:', session.bytesUsed);
```

**Troubleshooting:**
- If bytes don't increment: Check WebSocket connection
- If attestor doesn't update: Check `/record-usage` endpoint

---

### Phase 5: Settle Session ✅

**What Happens:**
1. Click "DISCONNECT" button
2. VPN page calls: `POST /settle-session-tx`
3. Attestor builds settlement transaction
4. Phantom prompts for signature
5. Smart contract calculates payout:
   ```rust
   payout = (bytes_used / 1_048_576) * price_per_mb
   protocol_fee = payout / 100  // 1%
   node_payment = payout - protocol_fee
   ```
6. Tokens transfer: Escrow PDA → Node operator
7. Session marked `closed = true`
8. WebSocket disconnects

**Expected Behavior:**
- Phantom transaction prompt
- Success notification: "Session settled! Tokens transferred..."
- Button returns to "CONNECT" (blue pulse)
- Status: "🔴 Not Protected"
- Bandwidth monitor resets to 0

**On-Chain Verification:**
```powershell
# Check session closed
solana account <SESSION_PDA> --url devnet
# Data byte at offset 96 should be 1 (closed)

# Check node operator received tokens
spl-token accounts <DVPN_MINT> --owner <NODE_OPERATOR_PUBKEY> --url devnet
```

**Troubleshooting:**
- **"Session already closed"** → Session PDA corrupted, create new one
- **"Insufficient balance"** → Escrow doesn't have enough tokens

---

## Manual Testing Checklist

### Frontend Features
- [ ] Wallet connects successfully
- [ ] SOL balance displays correctly
- [ ] DVPN token balance displays
- [ ] Server list loads from blockchain
- [ ] Map shows server locations correctly
- [ ] Clicking server selects it
- [ ] Connect button is disabled without wallet/server
- [ ] Loading states show during transactions
- [ ] Error notifications appear on failures
- [ ] Success notifications confirm actions
- [ ] Protected/Not Protected badge updates
- [ ] Bandwidth monitor shows real data
- [ ] Disconnect resets UI properly

### Backend Services
- [ ] Attestor starts on port 8787
- [ ] Node operator starts WebSocket on 3001
- [ ] `/nodes` endpoint returns registered nodes
- [ ] `/start-session-tx` builds valid transaction
- [ ] `/settle-session-tx` builds valid transaction
- [ ] `/record-usage` accepts and logs usage
- [ ] WebSocket accepts connections
- [ ] WebSocket echoes messages
- [ ] Periodic usage reporting works

### Smart Contract
- [ ] `start_session` creates Session PDA
- [ ] Token transfer to escrow succeeds
- [ ] `submit_usage` increments bytes_used
- [ ] Only attestor can submit usage
- [ ] `settle_session` calculates payout correctly
- [ ] Protocol fee deducted (1%)
- [ ] Tokens transfer to node operator
- [ ] Session marked closed after settlement
- [ ] Cannot settle closed session
- [ ] Events emitted correctly

---

## Automated Testing (Future)

### Unit Tests (Rust)
```bash
anchor test
```

### Integration Tests (TypeScript)
```bash
cd tests
npm test
```

### E2E Tests (Playwright)
```bash
cd apps/web
npm run test:e2e
```

---

## Performance Testing

### Load Test Node Operator
```javascript
// Create 100 concurrent WebSocket connections
const connections = [];
for (let i = 0; i < 100; i++) {
  const ws = new WebSocket('ws://localhost:3001');
  ws.onopen = () => {
    setInterval(() => {
      ws.send(`Test data from client ${i}`);
    }, 100);
  };
  connections.push(ws);
}
```

**Expected Behavior:**
- All connections accepted
- Node operator logs show all clients
- Periodic reporting aggregates all sessions
- No crashes or memory leaks

---

## Security Testing

### Attempt Unauthorized Actions
1. **Submit usage without attestor key:**
   ```javascript
   // Should fail with "Unauthorized" error
   await program.methods.submitUsage(new BN(1000))
     .accounts({ attestor: hackerPubkey, ... })
     .rpc();
   ```

2. **Settle session for another user:**
   ```javascript
   // Should fail - session PDA derived from user+node
   ```

3. **Double-settle session:**
   ```javascript
   // Should fail with "SessionClosed" error
   ```

### Attack Vectors
- [ ] Cannot drain escrow without settling
- [ ] Cannot forge attestor signature
- [ ] Cannot replay transactions
- [ ] Cannot frontrun settlement
- [ ] Cannot manipulate bytes_used directly

---

## Common Issues & Solutions

### Issue: "Program account not found"
**Solution:** Program not deployed to devnet
```bash
anchor deploy --provider.cluster devnet
```

### Issue: "Account does not have enough SOL"
**Solution:** Airdrop devnet SOL
```bash
solana airdrop 2 <YOUR_WALLET> --url devnet
```

### Issue: "WebSocket connection refused"
**Solution:** Node operator not running
```powershell
.\start-all-services.ps1
```

### Issue: "Transaction too large"
**Solution:** Reduce transaction accounts or use versioned transactions

### Issue: "Blockhash not found"
**Solution:** Devnet RPC overloaded, retry or use private RPC

---

## Test Data

### Test Wallets (Devnet Only)
Generate test wallets:
```bash
solana-keygen new --outfile test-user-1.json
solana-keygen new --outfile test-user-2.json
```

### Mint Test DVPN Tokens
```bash
spl-token create-token --decimals 6
spl-token create-account <MINT>
spl-token mint <MINT> 1000 <ACCOUNT>
```

---

## Success Criteria

✅ **MVP is production-ready when:**
1. User can connect Phantom wallet
2. User sees real nodes from blockchain
3. User can start session with token deposit
4. Bandwidth data tracked and displayed
5. Settlement transfers tokens to operator
6. All transactions succeed on devnet
7. No critical bugs or crashes
8. Error handling graceful and informative

---

## Next Steps After Testing

1. Deploy to mainnet-beta
2. Set up monitoring (Datadog, Sentry)
3. Add rate limiting to services
4. Implement proper authentication
5. Add session encryption
6. Set up CI/CD pipeline
7. Write audit report
8. Launch beta program

---

**Happy Testing! 🚀**

For questions or issues, check:
- Attestor logs: Terminal window 1
- Node operator logs: Terminal window 2
- Frontend console: Browser DevTools
- Smart contract events: Solana Explorer (devnet)

