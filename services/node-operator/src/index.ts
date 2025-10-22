import fetch from "node-fetch";
import WebSocket, { WebSocketServer } from "ws";

const ATTESTOR_URL = process.env.ATTESTOR_URL || "http://localhost:8787";
const OPERATOR_PUBKEY = process.env.OPERATOR_PUBKEY || "";

async function main() {
  if (!OPERATOR_PUBKEY) {
    console.error("Missing OPERATOR_PUBKEY env var.");
    process.exit(1);
  }

  // Fallback simple WS server to avoid libp2p version churn
  const wss = new WebSocketServer({ port: 0, host: "0.0.0.0" });
  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));
  const address = wss.address();
  const port = typeof address === "string" ? address : address?.port;
  console.log("ws server listening on ws://127.0.0.1:" + port);

  let totalBytes = 0n;
  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (data: WebSocket.RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      totalBytes += BigInt(buf.length);
      ws.send(buf); // echo
    });
  });

  setInterval(async () => {
    if (totalBytes === 0n) return;
    const report = Number(totalBytes);
    totalBytes = 0n;
    console.log(`Reporting ${report} bytes to attestor...`);
    try {
      const res = await fetch(`${ATTESTOR_URL}/record-usage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operator: OPERATOR_PUBKEY, bytes: report })
      });
      const data = await res.json();
      console.log("Attestor response:", data);
    } catch (e) {
      console.error("Failed to report usage", e);
    }
  }, 10_000);

  console.log("Node operator running.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


