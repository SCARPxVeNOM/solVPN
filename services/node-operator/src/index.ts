import fetch from "node-fetch";
import WebSocket, { WebSocketServer } from "ws";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const ATTESTOR_URL = process.env.ATTESTOR_URL || "http://localhost:8787";
const OPERATOR_PUBKEY = process.env.OPERATOR_PUBKEY || "";
const NODE_WS_PORT = parseInt(process.env.NODE_WS_PORT || "3001");

interface SessionInfo {
  user: string;
  startedAt: number;
  totalBytes: bigint;
}

async function main() {
  if (!OPERATOR_PUBKEY) {
    console.error("Missing OPERATOR_PUBKEY env var.");
    process.exit(1);
  }

  // Track active sessions
  const activeSessions = new Map<string, SessionInfo>();

  // WebSocket server for VPN clients
  const wss = new WebSocketServer({ port: NODE_WS_PORT, host: "0.0.0.0" });
  
  wss.on("listening", () => {
    console.log(`✅ VPN Node WebSocket listening on ws://0.0.0.0:${NODE_WS_PORT}`);
    console.log(`📡 Operator: ${OPERATOR_PUBKEY}`);
    console.log(`🔗 Attestor: ${ATTESTOR_URL}`);
  });

  wss.on("connection", (ws: WebSocket, req) => {
    const clientId = req.socket.remoteAddress + ":" + req.socket.remotePort;
    console.log(`\n🔌 New VPN client connected: ${clientId}`);

    // Initialize session
    const session: SessionInfo = {
      user: clientId,
      startedAt: Date.now(),
      totalBytes: 0n,
    };
    activeSessions.set(clientId, session);

    ws.on("message", (data: WebSocket.RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const bytesReceived = BigInt(buf.length);
      
      // Update session bytes
      session.totalBytes += bytesReceived;
      
      // Simulate VPN traffic by echoing (in production, this would route to internet)
      const responseData = Buffer.from(`VPN_RESPONSE: ${buf.toString()}`);
      ws.send(responseData);
      
      // Update total bytes including response
      session.totalBytes += BigInt(responseData.length);
      
      console.log(`📊 ${clientId}: +${bytesReceived} bytes (total: ${session.totalBytes})`);
    });

    ws.on("close", () => {
      console.log(`\n❌ Client disconnected: ${clientId}`);
      console.log(`   Session duration: ${((Date.now() - session.startedAt) / 1000).toFixed(1)}s`);
      console.log(`   Total data: ${session.totalBytes} bytes`);
      activeSessions.delete(clientId);
    });

    ws.on("error", (error) => {
      console.error(`⚠️  WebSocket error for ${clientId}:`, error.message);
      activeSessions.delete(clientId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: "welcome",
      message: "Connected to solVPN node",
      operator: OPERATOR_PUBKEY,
      timestamp: Date.now(),
    }));
  });

  // Periodic usage reporting to attestor
  setInterval(async () => {
    let totalBytes = 0n;
    
    // Aggregate bytes from all active sessions
    for (const [clientId, session] of activeSessions.entries()) {
      totalBytes += session.totalBytes;
      // Reset session counter (cumulative reporting)
      session.totalBytes = 0n;
    }

    if (totalBytes === 0n) return;

    const report = Number(totalBytes);
    console.log(`\n📤 Reporting ${report} bytes to attestor...`);
    
    try {
      const res = await fetch(`${ATTESTOR_URL}/record-usage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          operator: OPERATOR_PUBKEY, 
          bytes: report,
          activeSessions: activeSessions.size,
          timestamp: Date.now(),
        })
      });
      
      const data = await res.json();
      console.log("✅ Attestor response:", data);
    } catch (e: any) {
      console.error("❌ Failed to report usage:", e.message);
    }
  }, 10_000); // Report every 10 seconds

  // Heartbeat to keep connections alive
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "heartbeat",
          timestamp: Date.now(),
          serverLoad: activeSessions.size,
        }));
      }
    });
  }, 30_000); // Every 30 seconds

  // Stats logging
  setInterval(() => {
    if (activeSessions.size > 0) {
      console.log(`\n📈 Active sessions: ${activeSessions.size}`);
      for (const [clientId, session] of activeSessions.entries()) {
        const duration = ((Date.now() - session.startedAt) / 1000).toFixed(0);
        console.log(`   - ${clientId}: ${session.totalBytes} bytes (${duration}s)`);
      }
    }
  }, 60_000); // Every minute

  console.log("\n🚀 Node operator running and ready for VPN connections!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


