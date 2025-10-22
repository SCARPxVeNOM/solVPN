import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import dotenv from "dotenv";
import { createHash } from "crypto";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!; // operator uses same key for now
const PROGRAM_ID = process.env.PROGRAM_ID!;

// Inputs via env for simplicity
const STAKE_LAMPORTS = BigInt(process.env.NODE_STAKE_LAMPORTS || "10000000"); // 0.01 SOL
const BANDWIDTH_MBPS = Number(process.env.NODE_BANDWIDTH_MBPS || 100);
const META_HASH_HEX = process.env.NODE_META_HASH || "00".repeat(32);

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error("NODE_META_HASH must be 32-byte hex");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function main() {
  const operator = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET_KEY)));
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), operator.publicKey.toBuffer()],
    programId
  );
  const [nodePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("node"), operator.publicKey.toBuffer()],
    programId
  );

  const disc = createHash("sha256").update("global:register_node").digest().subarray(0, 8);
  const data = Buffer.concat([
    disc,
    Buffer.from(Uint8Array.from((() => {
      // u64 little endian
      const n = STAKE_LAMPORTS;
      const arr = new Uint8Array(8);
      let v = n;
      for (let i = 0; i < 8; i++) { arr[i] = Number(v & 0xffn); v >>= 8n; }
      return arr;
    })())),
    Buffer.from(Uint8Array.of(
      BANDWIDTH_MBPS & 0xff,
      (BANDWIDTH_MBPS >> 8) & 0xff,
      (BANDWIDTH_MBPS >> 16) & 0xff,
      (BANDWIDTH_MBPS >> 24) & 0xff
    )),
    Buffer.from(hexToBytes(META_HASH_HEX)),
  ]);

  const keys = [
    { pubkey: operator.publicKey, isSigner: true, isWritable: true },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: nodePda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [operator], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Registered node:", nodePda.toBase58(), "tx:", sig);
}

main().catch((e) => { console.error(e); process.exit(1); });


