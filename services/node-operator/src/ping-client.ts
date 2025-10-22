import WebSocket from "ws";

const TARGET_URL = process.env.TARGET_URL || "ws://127.0.0.1:24642";

async function main() {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(TARGET_URL);
    ws.once("open", () => {
      const payload = Buffer.alloc(256 * 1024, 1);
      ws.send(payload, (err) => {
        if (err) return reject(err);
        console.log("sent 256KiB to", TARGET_URL);
        ws.close();
        resolve();
      });
    });
    ws.once("error", reject);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });


