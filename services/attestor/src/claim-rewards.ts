import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import dotenv from "dotenv";
import { createHash } from "crypto";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, getMint, getAccount } from "@solana/spl-token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!; // operator uses same key for now
const PROGRAM_ID = process.env.PROGRAM_ID!;
// Ignore any DVPN_MINT in .env; always read from on-chain state

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

  // read current mint from state
  const stateAcc = await connection.getAccountInfo(statePda);
  if (!stateAcc) throw new Error("State not found");
  const offMint = 8 + 32 + 32;
  const mint = new PublicKey(stateAcc.data.slice(offMint, offMint + 32));

  // Ensure operator ATA exists
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    operator, // payer
    mint,
    operator.publicKey,
    true,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Debug: fetch node account and mint decimals
  const nodeAcc = await connection.getAccountInfo(nodePda);
  if (!nodeAcc) throw new Error("Node account not found");
  const off = 8 + 32 + 4 + 32 + 8 + 8; // discriminator + operator + bandwidth + meta + stake + total_bytes
  const unclaimed = nodeAcc.data.readBigUInt64LE(off);
  const mintInfo = await getMint(connection, mint);
  const ataInfo = await getAccount(connection, ata.address);
  const mintAccInfo = await connection.getAccountInfo(mint);
  const ataAccInfo = await connection.getAccountInfo(ata.address);
  console.log(
    "Node unclaimed:", unclaimed.toString(),
    "mint:", mint.toBase58(), "mint owner:", mintAccInfo?.owner.toBase58(),
    "mint decimals:", mintInfo.decimals, "mint supply:", mintInfo.supply.toString(),
    "ata:", ata.address.toBase58(), "ata owner:", ataAccInfo?.owner.toBase58(), "ata amount:", ataInfo.amount.toString()
  );

  const disc = createHash("sha256").update("global:claim_rewards").digest().subarray(0, 8);
  const data = Buffer.from(disc);

  const keys = [
    { pubkey: operator.publicKey, isSigner: true, isWritable: true },
    { pubkey: statePda, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: false }, // state_signer PDA (same address)
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: nodePda, isSigner: false, isWritable: true },
    { pubkey: ata.address, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [operator], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Claimed rewards to ATA:", ata.address.toBase58(), "tx:", sig);
}

main().catch((e) => { console.error(e); process.exit(1); });


