import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import { z } from "zod";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
const exec = promisify(execCb);

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.ATTESTOR_SECRET_KEY; // array JSON

if (!SECRET_KEY) {
  console.error("Missing ATTESTOR_SECRET_KEY (JSON array)");
  process.exit(1);
}

const secret = Uint8Array.from(JSON.parse(SECRET_KEY));
const wallet = Keypair.fromSecretKey(secret);
const connection = new Connection(RPC, "confirmed");
if (!process.env.PROGRAM_ID) {
  console.error("Missing PROGRAM_ID in env");
  process.exit(1);
}
const programId = new PublicKey(process.env.PROGRAM_ID);

const app = express();
app.use(cors());
app.use(express.json());

const usageSchema = z.object({
  operator: z.string(),
  bytes: z.number().int().nonnegative(),
});

app.post("/record-usage", async (req, res) => {
  try {
    const { operator, bytes } = usageSchema.parse(req.body);
    // TODO: integrate real proof input; placeholder call to external verifier script
    try {
      const { stdout } = await exec("bash -lc 'cd ../../circuits && ./verify-proof.sh'");
      if (!stdout.includes("OK")) throw new Error("invalid proof");
    } catch (err) {
      return res.status(400).json({ ok: false, error: "invalid proof" });
    }
    const operatorPk = new PublicKey(operator);
    // Derive PDAs
    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), wallet.publicKey.toBuffer()], programId);
    const [nodePda] = PublicKey.findProgramAddressSync([Buffer.from("node"), operatorPk.toBuffer()], programId);
    // Build instruction data: discriminator + u64 bytes
    const disc = createHash("sha256").update("global:record_usage").digest().subarray(0, 8);
    let v = BigInt(bytes);
    const u64 = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) { u64[i] = Number(v & 0xffn); v >>= 8n; }
    const data = Buffer.concat([disc, u64]);
    const keys = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: nodePda, isSigner: false, isWritable: true },
    ];
    const ix = new TransactionInstruction({ programId, keys, data });
    const tx = new Transaction().add(ix);
    const sig = await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");
    res.json({ ok: true, tx: sig });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Build an unsigned transaction for client wallet to sign: register_node
const registerSchema = z.object({
  operator: z.string(),
  stakeLamports: z.union([z.string(), z.number()]),
  bandwidthMbps: z.number().int().nonnegative(),
  metaHash: z.array(z.number().int().min(0).max(255)).length(32),
});

app.post("/register-tx", async (req, res) => {
  try {
    const { operator, stakeLamports, bandwidthMbps, metaHash } = registerSchema.parse(req.body);
    const operatorPk = new PublicKey(operator);
    const [nodePda] = PublicKey.findProgramAddressSync([Buffer.from("node"), operatorPk.toBuffer()], programId);

    const disc = createHash("sha256").update("global:register_node").digest().subarray(0, 8);
    // u64 little-endian
    let v = BigInt(typeof stakeLamports === "string" ? stakeLamports : stakeLamports);
    const u64 = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) { u64[i] = Number(v & 0xffn); v >>= 8n; }
    // u32 little-endian bandwidth
    const u32 = Buffer.from([
      bandwidthMbps & 0xff,
      (bandwidthMbps >> 8) & 0xff,
      (bandwidthMbps >> 16) & 0xff,
      (bandwidthMbps >> 24) & 0xff,
    ]);
    const meta = Buffer.from(Uint8Array.from(metaHash));
    const data = Buffer.concat([disc, u64, u32, meta]);

    const keys = [
      { pubkey: operatorPk, isSigner: true, isWritable: true },
      { pubkey: nodePda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const ix = new TransactionInstruction({ programId, keys, data });
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: operatorPk, recentBlockhash: blockhash }).add(ix);
    const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    res.json({ ok: true, tx: b64 });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Build an unsigned transaction for client wallet to sign: claim_rewards
const claimSchema = z.object({ operator: z.string() });
app.post("/claim-tx", async (req, res) => {
  try {
    const { operator } = claimSchema.parse(req.body);
    const operatorPk = new PublicKey(operator);

    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), wallet.publicKey.toBuffer()], programId);
    const [nodePda] = PublicKey.findProgramAddressSync([Buffer.from("node"), operatorPk.toBuffer()], programId);

    // Read mint from state
    const acc = await connection.getAccountInfo(statePda);
    if (!acc) throw new Error("state not found");
    const mint = new PublicKey(acc.data.slice(8 + 32 + 32, 8 + 32 + 32 + 32));

    const ata = getAssociatedTokenAddressSync(mint, operatorPk, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    const disc = createHash("sha256").update("global:claim_rewards").digest().subarray(0, 8);
    const data = Buffer.from(disc);
    const keys = [
      { pubkey: operatorPk, isSigner: true, isWritable: true },
      { pubkey: statePda, isSigner: false, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: false }, // state_signer PDA (same address)
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: nodePda, isSigner: false, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const ix = new TransactionInstruction({ programId, keys, data });
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: operatorPk, recentBlockhash: blockhash }).add(ix);
    const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    res.json({ ok: true, tx: b64 });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Expose state PDA and mint to the UI
app.get("/state", async (_req, res) => {
  try {
    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), wallet.publicKey.toBuffer()], programId);
    const acc = await connection.getAccountInfo(statePda);
    if (!acc) return res.status(404).json({ ok: false, error: "state not found" });
    const mint = new PublicKey(acc.data.slice(8 + 32 + 32, 8 + 32 + 32 + 32));
    res.json({ ok: true, state: statePda.toBase58(), mint: mint.toBase58(), authority: wallet.publicKey.toBase58() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Faucet endpoint - mint tokens to user for testing
const faucetSchema = z.object({
  user: z.string(),
  amount: z.number().optional(),
});

app.post("/faucet", async (req, res) => {
  try {
    const { user } = faucetSchema.parse(req.body);
    const userPk = new PublicKey(user);
    
    // Send devnet SOL for gas fees
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: wallet.publicKey, recentBlockhash: blockhash });
    
    const solTransferIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: userPk,
      lamports: 500_000_000, // 0.5 SOL for gas fees
    });
    tx.add(solTransferIx);
    
    // Sign and send
    tx.sign(wallet);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);
    
    res.json({ 
      ok: true, 
      signature, 
      amount: 500_000_000,
      message: `Sent 0.5 SOL for gas fees! You can now start VPN sessions. DVPN tokens are not needed for deposits - the session works without pre-minted tokens.` 
    });
  } catch (e: any) {
    console.error("faucet error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Fetch all registered nodes
app.get("/nodes", async (_req, res) => {
  try {
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        { dataSize: 100 }, // Approximate size of Node account
      ],
    });
    
    const nodes = accounts.map(account => ({
      pubkey: account.pubkey.toBase58(),
      operator: new PublicKey(account.account.data.slice(8, 40)).toBase58(),
      bandwidthMbps: account.account.data.readUInt32LE(40),
      stakeLamports: Number(account.account.data.readBigUInt64LE(76)),
      totalBytesRelayed: Number(account.account.data.readBigUInt64LE(84)),
    }));
    
    res.json({ ok: true, nodes });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Build start_session transaction
const startSessionSchema = z.object({
  user: z.string(),
  node: z.string(),
  depositAmount: z.number(),
});

app.post("/start-session-tx", async (req, res) => {
  try {
    const { user, node, depositAmount } = startSessionSchema.parse(req.body);
    const userPk = new PublicKey(user);
    const nodePk = new PublicKey(node);
    
    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), wallet.publicKey.toBuffer()], programId);
    const [sessionPda] = PublicKey.findProgramAddressSync([Buffer.from("session"), userPk.toBuffer(), nodePk.toBuffer()], programId);
    
    // Build start_session instruction (simplified - no token transfer)
    const disc = createHash("sha256").update("global:start_session").digest().subarray(0, 8);
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(depositAmount));
    const data = Buffer.concat([disc, amountBuf]);
    
    const keys = [
      { pubkey: sessionPda, isSigner: false, isWritable: true },
      { pubkey: userPk, isSigner: true, isWritable: true },
      { pubkey: nodePk, isSigner: false, isWritable: true },
      { pubkey: statePda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const startSessionIx = new TransactionInstruction({ programId, keys, data });
    
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: userPk, recentBlockhash: blockhash }).add(startSessionIx);
    
    const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    
    res.json({ ok: true, tx: b64, sessionPda: sessionPda.toBase58() });
  } catch (e: any) {
    console.error("start-session-tx error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Build settle_session transaction
const settleSessionSchema = z.object({
  user: z.string(),
  node: z.string(),
});

app.post("/settle-session-tx", async (req, res) => {
  try {
    const { user, node } = settleSessionSchema.parse(req.body);
    const userPk = new PublicKey(user);
    const nodePk = new PublicKey(node);
    
    const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), wallet.publicKey.toBuffer()], programId);
    const [sessionPda] = PublicKey.findProgramAddressSync([Buffer.from("session"), userPk.toBuffer(), nodePk.toBuffer()], programId);
    
    // Get mint from state
    const stateAcc = await connection.getAccountInfo(statePda);
    if (!stateAcc) throw new Error("State account not found");
    const mint = new PublicKey(stateAcc.data.slice(8 + 32 + 32, 8 + 32 + 32 + 32));
    
    // Get node operator pubkey from node account
    const nodeAcc = await connection.getAccountInfo(nodePk);
    if (!nodeAcc) throw new Error("Node account not found");
    const nodeOperator = new PublicKey(nodeAcc.data.slice(8, 40)); // operator pubkey at offset 8
    
    // Calculate token accounts
    const escrowTokenAccount = getAssociatedTokenAddressSync(mint, sessionPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const nodeTokenAccount = getAssociatedTokenAddressSync(mint, nodeOperator, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    
    const disc = createHash("sha256").update("global:settle_session").digest().subarray(0, 8);
    const data = Buffer.from(disc);
    
    const keys = [
      { pubkey: sessionPda, isSigner: false, isWritable: true },
      { pubkey: nodePk, isSigner: false, isWritable: true },
      { pubkey: userPk, isSigner: false, isWritable: false },
      { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
      { pubkey: nodeTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: userPk, isSigner: true, isWritable: false }, // User must sign to settle their own session
    ];
    
    const ix = new TransactionInstruction({ programId, keys, data });
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: userPk, recentBlockhash: blockhash }).add(ix);
    const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    
    res.json({ ok: true, tx: b64 });
  } catch (e: any) {
    console.error("settle-session-tx error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Attestor listening on :${PORT}`);
});


