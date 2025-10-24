// wg-manager.ts - lightweight wrapper to create keys and read client config
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const OUTDIR = path.resolve(__dirname, "../wg-keys");

export function ensureKeysExist(): { nodePub: string; clientConfPath: string } {
  if (!fs.existsSync(OUTDIR)) {
    fs.mkdirSync(OUTDIR, { recursive: true, mode: 0o700 });
  }
  const clientConf = path.join(OUTDIR, "client-wg.conf");
  const nodePubPath = path.join(OUTDIR, "node_public.key");
  if (!fs.existsSync(nodePubPath) || !fs.existsSync(clientConf)) {
    // Try to run gen script (assumes it's present and executable)
    const script = path.resolve(__dirname, "../scripts/gen-wg-config.sh");
    try {
      execSync(`bash ${script}`, { stdio: "inherit" });
    } catch (e) {
      console.warn("Could not generate WG keys automatically. Please run scripts/gen-wg-config.sh manually.");
      throw e;
    }
  }
  const nodePub = fs.readFileSync(nodePubPath, "utf8").trim();
  return { nodePub, clientConfPath: clientConf };
}

export function readClientConfig(): string {
  const { clientConfPath } = ensureKeysExist();
  return fs.readFileSync(clientConfPath, "utf8");
}

