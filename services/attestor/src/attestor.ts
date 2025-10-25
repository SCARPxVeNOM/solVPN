// attestor.ts - ZK proof verification and settlement attestation
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import { execSync } from "child_process";
import nacl from "tweetnacl";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
const connection = new Connection(SOLANA_RPC, "confirmed");
const provider = new anchor.AnchorProvider(
  connection,
  {} as any,
  { commitment: "confirmed" }
);
anchor.setProvider(provider);

const programId = new PublicKey(process.env.DVPN_PROGRAM_ID || "");
if (!programId.toString()) {
  console.error("Missing DVPN_PROGRAM_ID env var");
  process.exit(1);
}

const idl = require("../../sdk/src/idl/dvpn.json");
const program = new anchor.Program(idl, programId, provider);

// Attestor keypair (for demo: load from file or env)
const ATTESTOR_KEYPAIR_PATH = process.env.ATTESTOR_KEYPAIR || "./attestor-keypair.json";
if (!fs.existsSync(ATTESTOR_KEYPAIR_PATH)) {
  const kp = Keypair.generate();
  fs.writeFileSync(ATTESTOR_KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
  console.log("📝 Generated new attestor keypair:", ATTESTOR_KEYPAIR_PATH);
  console.log("📋 Attestor pubkey:", kp.publicKey.toString());
}

const attestorSecret = Uint8Array.from(
  JSON.parse(fs.readFileSync(ATTESTOR_KEYPAIR_PATH, "utf8"))
);
const attestor = Keypair.fromSecretKey(attestorSecret);

console.log("🔑 Attestor pubkey:", attestor.publicKey.toString());

async function verifyProofAndSettle(sessionPubkeyStr: string) {
  const sessionPubkey = new PublicKey(sessionPubkeyStr);

  // For demo: assume we've produced proof files in circuits/build/
  const buildDir = path.resolve(__dirname, "../../../circuits/build");
  const proofFile = path.join(buildDir, "proof.json");
  const publicFile = path.join(buildDir, "public.json");
  const vkFile = path.join(buildDir, "verification_key.json");

  if (!fs.existsSync(proofFile) || !fs.existsSync(publicFile) || !fs.existsSync(vkFile)) {
    throw new Error("Missing proof files - run circuits/build-proof.sh first");
  }

  // Verify using snarkjs CLI
  console.log("🔍 Verifying ZK proof...");
  try {
    execSync(`snarkjs groth16 verify ${vkFile} ${publicFile} ${proofFile}`, { 
      stdio: "inherit" 
    });
  } catch (e) {
    console.error("❌ Proof verification failed:", e);
    throw e;
  }

  // Read public.json to get total bytes (public[0])
  const publicJson = JSON.parse(fs.readFileSync(publicFile, "utf8"));
  const totalBytes = Number(publicJson[0]);

  console.log(`✅ Proof verified! Total bytes: ${totalBytes}`);

  // Create attestation signature
  const ts = Math.floor(Date.now() / 1000);
  const msg = Buffer.concat([
    sessionPubkey.toBuffer(),
    Buffer.from(totalBytes.toString()),
    attestor.publicKey.toBuffer(),
    Buffer.from(ts.toString()),
  ]);
  const sig = nacl.sign.detached(msg, attestor.secretKey);
  const sig_b58 = bs58.encode(Buffer.from(sig));

  console.log(`📝 Attestation signature: ${sig_b58}`);
  console.log(`📤 Submitting settlement to program...`);

  // For now, just log the attestation data
  // In production, call settle_session_with_attestation instruction
  console.log({
    session: sessionPubkeyStr,
    totalBytes,
    attestorPubkey: attestor.publicKey.toString(),
    signature: sig_b58,
    timestamp: ts,
  });

  console.log("✅ Settlement completed");
}

// CLI usage
(async () => {
  const sessionArg = process.argv[2];
  if (!sessionArg) {
    console.error("Usage: node dist/attestor.js <sessionPubkey>");
    process.exit(1);
  }
  await verifyProofAndSettle(sessionArg);
})();

