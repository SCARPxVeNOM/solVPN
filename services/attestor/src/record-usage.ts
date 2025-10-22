import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import dotenv from "dotenv";
import { createHash } from "crypto";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!; // attestor uses same key for now
const PROGRAM_ID = process.env.PROGRAM_ID!;
const BYTES = BigInt(process.env.USAGE_BYTES || "1048576"); // 1 MiB

async function main() {
  const attestor = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET_KEY)));
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);

  // For demo, node PDA is derived from attestor as operator; adjust if different operator
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), attestor.publicKey.toBuffer()],
    programId
  );
  const [nodePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("node"), attestor.publicKey.toBuffer()],
    programId
  );

  const disc = createHash("sha256").update("global:record_usage").digest().subarray(0, 8);
  const u64le = Buffer.from(Uint8Array.from((() => {
    const n = BYTES; const a = new Uint8Array(8); let v = n; for (let i=0;i<8;i++){ a[i]=Number(v & 0xffn); v >>= 8n; } return a;
  })()));
  const data = Buffer.concat([disc, u64le]);

  const keys = [
    { pubkey: attestor.publicKey, isSigner: true, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: nodePda, isSigner: false, isWritable: true },
  ];
  const ix = new TransactionInstruction({ programId, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [attestor], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Recorded usage for node:", nodePda.toBase58(), "bytes:", BYTES.toString(), "tx:", sig);
}

main().catch((e) => { console.error(e); process.exit(1); });


