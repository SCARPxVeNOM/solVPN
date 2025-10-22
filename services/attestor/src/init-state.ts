import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import dotenv from "dotenv";
import { createHash } from "crypto";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!;
const MINT = process.env.DVPN_MINT!;
const REWARD_BPS = Number(process.env.REWARD_BPS || 5);
const PROGRAM_ID = process.env.PROGRAM_ID!;

async function main() {
  if (!PROGRAM_ID) throw new Error("PROGRAM_ID missing in .env");
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET_KEY)));
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);
  const dvpnMint = new PublicKey(MINT);

  // Derive state PDA and bump
  const [statePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), authority.publicKey.toBuffer()],
    programId
  );

  // Anchor instruction discriminator: sha256("global:initialize_state")[..8]
  const discriminator = createHash("sha256").update("global:initialize_state").digest().subarray(0, 8);
  const args = Buffer.alloc(1 + 2);
  args.writeUInt8(bump, 0);
  args.writeUInt16LE(REWARD_BPS, 1);
  const data = Buffer.concat([discriminator, args]);

  const keys = [
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: statePda, isSigner: false, isWritable: false }, // state_signer PDA
    { pubkey: dvpnMint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [authority], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Initialized state for", authority.publicKey.toBase58(), "tx:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


