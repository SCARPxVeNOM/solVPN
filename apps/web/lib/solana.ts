import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, web3 } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Configuration
export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || "8j3TUcbSuaq5BVNSf5GJhgucwrswH432sqJNxCoym8hB");
export const ATTESTOR_URL = process.env.NEXT_PUBLIC_ATTESTOR_URL || "http://localhost:8787";

export interface NodeData {
  operator: PublicKey;
  bandwidthMbps: number;
  metaHash: number[];
  stakeLamports: number;
  totalBytesRelayed: number;
  unclaimedReward: number;
}

export interface SessionData {
  user: PublicKey;
  node: PublicKey;
  depositAmount: number;
  bytesUsed: number;
  startedAt: number;
  closed: boolean;
  bump: number;
}

export interface StateData {
  authority: PublicKey;
  attestor: PublicKey;
  mint: PublicKey;
  rewardRateBps: number;
  bump: number;
}

// PDAs
export function getStatePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state"), authority.toBuffer()],
    PROGRAM_ID
  );
}

export function getNodePda(operator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("node"), operator.toBuffer()],
    PROGRAM_ID
  );
}

export function getSessionPda(user: PublicKey, node: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("session"), user.toBuffer(), node.toBuffer()],
    PROGRAM_ID
  );
}

// Fetch all registered nodes from blockchain
export async function fetchAllNodes(connection: Connection): Promise<Array<{ pubkey: PublicKey; data: NodeData }>> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: "", // Filter for Node accounts (would need proper discriminator)
        },
      },
    ],
  });

  return accounts
    .map((account) => {
      try {
        // Parse account data (simplified - in production use proper Anchor deserialization)
        const data = account.account.data;
        if (data.length < 100) return null;

        return {
          pubkey: account.pubkey,
          data: {
            operator: new PublicKey(data.slice(8, 40)),
            bandwidthMbps: data.readUInt32LE(40),
            metaHash: Array.from(data.slice(44, 76)),
            stakeLamports: Number(data.readBigUInt64LE(76)),
            totalBytesRelayed: Number(data.readBigUInt64LE(84)),
            unclaimedReward: Number(data.readBigUInt64LE(92)),
          },
        };
      } catch (e) {
        return null;
      }
    })
    .filter((n): n is { pubkey: PublicKey; data: NodeData } => n !== null);
}

// Fetch state data
export async function fetchState(connection: Connection, authority: PublicKey): Promise<StateData | null> {
  const [statePda] = getStatePda(authority);
  const accountInfo = await connection.getAccountInfo(statePda);
  
  if (!accountInfo) return null;

  const data = accountInfo.data;
  return {
    authority: new PublicKey(data.slice(8, 40)),
    attestor: new PublicKey(data.slice(40, 72)),
    mint: new PublicKey(data.slice(72, 104)),
    rewardRateBps: data.readUInt16LE(104),
    bump: data[106],
  };
}

// Start a VPN session
export async function startSession(
  connection: Connection,
  wallet: any,
  nodeOperator: PublicKey,
  depositAmount: number
): Promise<string> {
  const user = wallet.publicKey;
  const [nodePda] = getNodePda(nodeOperator);
  const [sessionPda] = getSessionPda(user, nodePda);
  const [statePda] = getStatePda(user); // Simplified - use proper authority

  // Build transaction via attestor service
  const response = await fetch(`${ATTESTOR_URL}/start-session-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: user.toBase58(),
      node: nodePda.toBase58(),
      depositAmount,
    }),
  });

  const { tx } = await response.json();
  
  // Sign and send via Phantom
  const signed = await wallet.signAndSendTransaction(tx);
  return signed.signature || signed;
}

// Settle a session
export async function settleSession(
  connection: Connection,
  wallet: any,
  nodeOperator: PublicKey
): Promise<string> {
  const user = wallet.publicKey;
  const [nodePda] = getNodePda(nodeOperator);
  const [sessionPda] = getSessionPda(user, nodePda);

  const response = await fetch(`${ATTESTOR_URL}/settle-session-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: user.toBase58(),
      node: nodePda.toBase58(),
    }),
  });

  const { tx } = await response.json();
  const signed = await wallet.signAndSendTransaction(tx);
  return signed.signature || signed;
}

// Fetch session data
export async function fetchSession(
  connection: Connection,
  user: PublicKey,
  nodeOperator: PublicKey
): Promise<SessionData | null> {
  const [nodePda] = getNodePda(nodeOperator);
  const [sessionPda] = getSessionPda(user, nodePda);
  const accountInfo = await connection.getAccountInfo(sessionPda);
  
  if (!accountInfo) return null;

  const data = accountInfo.data;
  return {
    user: new PublicKey(data.slice(8, 40)),
    node: new PublicKey(data.slice(40, 72)),
    depositAmount: Number(data.readBigUInt64LE(72)),
    bytesUsed: Number(data.readBigUInt64LE(80)),
    startedAt: Number(data.readBigInt64LE(88)),
    closed: data[96] === 1,
    bump: data[97],
  };
}

// Get token balance
export async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const balance = await connection.getTokenAccountBalance(ata);
    return Number(balance.value.amount) / Math.pow(10, balance.value.decimals);
  } catch (e) {
    return 0;
  }
}

