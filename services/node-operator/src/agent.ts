import express from "express";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { readClientConfig } from "./wg-manager.js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.AGENT_PORT || "8788");
const SOLANA_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
const PROGRAM_ID = process.env.DVPN_PROGRAM_ID || "";

if (!PROGRAM_ID) {
  console.error("Missing DVPN_PROGRAM_ID env var");
  process.exit(1);
}

// Initialize Anchor program
const connection = new Connection(SOLANA_RPC, "confirmed");
const provider = new anchor.AnchorProvider(
  connection,
  {} as any, // No wallet needed for read-only operations
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

let program: anchor.Program;
try {
  const idlPath = path.resolve(__dirname, "../../sdk/src/idl/dvpn.json");
  const idlJson = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  program = new anchor.Program(idlJson, new PublicKey(PROGRAM_ID), provider);
} catch (e) {
  console.error("Failed to load program IDL:", e);
  process.exit(1);
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "node-operator-agent" });
});

// Endpoint to return WireGuard client config for a session
app.get("/wg-config", async (req, res) => {
  try {
    const session = req.query.session as string | undefined;
    if (!session) {
      return res.status(400).json({ error: "session param required" });
    }

    // Validate session on-chain
    const sessionPubkey = new PublicKey(session);
    let sessionAcct;
    try {
      sessionAcct = await (program.account as any).session.fetch(sessionPubkey);
    } catch (e) {
      return res.status(404).json({ error: "session not found" });
    }

    // Basic checks: not closed and deposit > 0
    if (sessionAcct.closed) {
      return res.status(400).json({ error: "session closed" });
    }
    
    const depositAmount = sessionAcct.depositAmount?.toNumber() || 0;
    if (depositAmount <= 0) {
      return res.status(400).json({ error: "insufficient deposit" });
    }

    // Read client config file (for demo)
    const cfg = readClientConfig();
    res.setHeader("Content-Type", "text/plain");
    res.send(cfg);
  } catch (err: any) {
    console.error("wg-config error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Session info endpoint
app.get("/session/:sessionPubkey", async (req, res) => {
  try {
    const sessionPubkey = new PublicKey(req.params.sessionPubkey);
    const sessionAcct = await (program.account as any).session.fetch(sessionPubkey);
    res.json({
      user: sessionAcct.user.toString(),
      nodeOperator: sessionAcct.nodeOperator.toString(),
      depositAmount: sessionAcct.depositAmount.toString(),
      bytesUsed: sessionAcct.bytesUsed.toString(),
      startTime: sessionAcct.startTime.toString(),
      closed: sessionAcct.closed,
    });
  } catch (err: any) {
    console.error("Session fetch error:", err);
    res.status(404).json({ error: "Session not found" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Node operator agent listening on http://0.0.0.0:${PORT}`);
  console.log(`📡 Connected to Solana: ${SOLANA_RPC}`);
  console.log(`🔗 Program ID: ${PROGRAM_ID}`);
});

