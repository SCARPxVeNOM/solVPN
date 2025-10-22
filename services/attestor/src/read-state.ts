import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const SECRET_KEY = process.env.INIT_AUTHORITY_SECRET_KEY!;
const PROGRAM_ID = process.env.PROGRAM_ID!;

async function main() {
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET_KEY)));
  const connection = new Connection(RPC, "confirmed");
  const programId = new PublicKey(PROGRAM_ID);
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("state"), kp.publicKey.toBuffer()], programId);
  const acc = await connection.getAccountInfo(statePda);
  if (!acc) throw new Error("state not found");
  const authority = new PublicKey(acc.data.slice(8, 40));
  const attestor = new PublicKey(acc.data.slice(40, 72));
  const mint = new PublicKey(acc.data.slice(72, 104));
  const rewardRateBps = acc.data.readUInt16LE(104);
  const bump = acc.data.readUInt8(106);
  console.log(JSON.stringify({ statePda: statePda.toBase58(), authority: authority.toBase58(), attestor: attestor.toBase58(), mint: mint.toBase58(), rewardRateBps, bump }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


