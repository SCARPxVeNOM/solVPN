import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import { setAuthority, AuthorityType, getMint } from "@solana/spl-token";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!; // current mint authority
const PROGRAM_ID = process.env.PROGRAM_ID!;
const DVPN_MINT = process.env.DVPN_MINT!;

async function main() {
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET_KEY)));
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);
  const mint = new PublicKey(DVPN_MINT);

  // state PDA is the PDA signer in program
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), authority.publicKey.toBuffer()],
    programId
  );

  const before = await getMint(connection, mint);
  console.log("Mint before:", { mintAuthority: before.mintAuthority?.toBase58() });

  const sig = await setAuthority(connection, authority, mint, authority.publicKey, AuthorityType.MintTokens, statePda);
  console.log("Set mint authority to state PDA:", statePda.toBase58(), "tx:", sig);

  const after = await getMint(connection, mint);
  console.log("Mint after:", { mintAuthority: after.mintAuthority?.toBase58() });
}

main().catch((e) => { console.error(e); process.exit(1); });


