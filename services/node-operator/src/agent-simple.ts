import express from "express";
import { readClientConfig } from "./wg-manager.js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.AGENT_PORT || "8788");

console.log(`🔷 Starting Simple WireGuard Agent...`);
console.log(`📡 Port: ${PORT}`);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "node-operator-agent-simple" });
});

// Endpoint to return WireGuard client config
app.get("/wg-config", async (req, res) => {
  try {
    const session = req.query.session as string | undefined;
    if (!session) {
      return res.status(400).json({ error: "session param required" });
    }

    console.log(`📥 WireGuard config requested for session: ${session}`);

    // Read and return the client config file
    const cfg = readClientConfig();
    res.setHeader("Content-Type", "text/plain");
    res.send(cfg);
    
    console.log(`✅ Config sent successfully`);
  } catch (err: any) {
    console.error("❌ wg-config error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Session info endpoint (simplified - returns basic info)
app.get("/session/:sessionPubkey", async (req, res) => {
  try {
    res.json({
      message: "Session info endpoint - connect to Solana RPC for full details",
      sessionPubkey: req.params.sessionPubkey,
      hint: "Use @solana/web3.js Connection class to fetch account data"
    });
  } catch (err: any) {
    console.error("Session fetch error:", err);
    res.status(404).json({ error: "Use Solana RPC to fetch session data" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Node operator agent (Simple) listening on http://0.0.0.0:${PORT}`);
  console.log(`🔑 WireGuard endpoint: GET /wg-config?session=<SESSION_PUBKEY>`);
  console.log(`❤️  Health check: GET /health`);
});

