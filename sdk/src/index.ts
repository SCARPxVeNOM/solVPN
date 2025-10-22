import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import BN from "bn.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const idlJson = JSON.parse(readFileSync(join(__dirname, "idl/dvpn.json"), "utf8"));

export type RegisterNodeArgs = {
  stakeLamports: bigint;
  bandwidthMbps: number;
  metaHash: Uint8Array; // 32 bytes
};

export class DvpnClient {
  readonly connection: Connection;
  readonly program: Program;

  constructor(provider: AnchorProvider, programId?: PublicKey) {
    this.connection = provider.connection;
    setProvider(provider);
    const pid = programId ?? new PublicKey((idlJson as any).address);
    this.program = new Program(idlJson as any, provider);
  }

  statePda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("state"), authority.toBuffer()], this.program.programId);
  }

  nodePda(operator: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("node"), operator.toBuffer()], this.program.programId);
  }

  async initializeState(args: { authority: PublicKey; mint: PublicKey; rewardRateBps: number }) {
    const [state, bump] = this.statePda(args.authority);
    await this.program.methods
      .initializeState(bump, args.rewardRateBps)
      .accounts({
        authority: args.authority,
        state,
        stateSigner: state,
        dvpnMint: args.mint,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async registerNode(args: RegisterNodeArgs, operator: PublicKey) {
    const [state] = this.statePda(operator); // simplified: operator == authority
    const [node] = this.nodePda(operator);
    await this.program.methods
      .registerNode(new BN(args.stakeLamports.toString()), args.bandwidthMbps, Array.from(args.metaHash))
      .accounts({ operator, state, node, systemProgram: SystemProgram.programId })
      .rpc();
  }
}

export { idlJson as dvpnIdl };


