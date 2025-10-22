import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import dotenv from "dotenv";
import { createMint, setAuthority, AuthorityType } from "@solana/spl-token";
import { createHash } from "crypto";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!; // state authority
const PROGRAM_ID = process.env.PROGRAM_ID!;

async function main() {
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET_KEY)));
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);

  // create fresh mint with 9 decimals
  const mint = await createMint(connection, authority, authority.publicKey, null, 9);
  console.log("Created mint:", mint.toBase58());

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), authority.publicKey.toBuffer()],
    programId
  );
  // transfer mint authority to state PDA
  await setAuthority(connection, authority, mint, authority.publicKey, AuthorityType.MintTokens, statePda);
  console.log("Mint authority set to state PDA:", statePda.toBase58());

  // call set_mint(new_mint)
  const disc = createHash("sha256").update("global:set_mint").digest().subarray(0, 8);
  const data = Buffer.concat([disc, mint.toBuffer()]);
  const keys = [
    { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
  ];
  const ix = new TransactionInstruction({ programId, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [authority], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  console.log("State mint updated. tx:", sig);

  console.log("DVPN_MINT for .env:", mint.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });


