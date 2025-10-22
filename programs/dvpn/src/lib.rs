use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("8j3TUcbSuaq5BVNSf5GJhgucwrswH432sqJNxCoym8hB");

#[program]
pub mod dvpn {
    use super::*;

    pub fn initialize_state(ctx: Context<InitializeState>, bump: u8, reward_rate_bps: u16) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.bump = bump;
        state.attestor = ctx.accounts.authority.key();
        state.mint = ctx.accounts.dvpn_mint.key();
        state.reward_rate_bps = reward_rate_bps;
        Ok(())
    }

    pub fn set_attestor(ctx: Context<SetAttestor>, new_attestor: Pubkey) -> Result<()> {
        require_keys_eq!(ctx.accounts.state.authority, ctx.accounts.authority.key(), DvpnError::Unauthorized);
        ctx.accounts.state.attestor = new_attestor;
        Ok(())
    }

    pub fn set_mint(ctx: Context<SetMint>, new_mint: Pubkey) -> Result<()> {
        require_keys_eq!(ctx.accounts.state.authority, ctx.accounts.authority.key(), DvpnError::Unauthorized);
        ctx.accounts.state.mint = new_mint;
        Ok(())
    }

    pub fn register_node(ctx: Context<RegisterNode>, stake_lamports: u64, bandwidth_mbps: u32, meta_hash: [u8; 32]) -> Result<()> {
        // Save node key before mutable borrow
        let node_key = ctx.accounts.node.key();
        let operator_key = ctx.accounts.operator.key();
        
        // Transfer SOL as stake
        invoke(
            &system_instruction::transfer(&operator_key, &node_key, stake_lamports),
            &[
                ctx.accounts.operator.to_account_info(),
                ctx.accounts.node.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Initialize node data
        let node = &mut ctx.accounts.node;
        node.operator = operator_key;
        node.bandwidth_mbps = bandwidth_mbps;
        node.meta_hash = meta_hash;
        node.total_bytes_relayed = 0;
        node.unclaimed_reward = 0;
        node.stake_lamports = stake_lamports;
        Ok(())
    }

    pub fn record_usage(ctx: Context<RecordUsage>, bytes: u64) -> Result<()> {
        // Only attestor can record usage for now; later ZK verification on-chain may authorize
        require_keys_eq!(ctx.accounts.state.attestor, ctx.accounts.attestor.key(), DvpnError::Unauthorized);
        let node = &mut ctx.accounts.node;
        node.total_bytes_relayed = node
            .total_bytes_relayed
            .checked_add(bytes)
            .ok_or(DvpnError::MathOverflow)?;
        // Accrue rewards as simple function of bytes and reward_rate_bps
        // reward = bytes * rate_bps / 10_000, scaled to token smallest unit (assume 9 decimals; actual mint decimals read off-chain for claims)
        // Here we simply store as raw units; mint happens on claim.
        let add = bytes
            .checked_mul(ctx.accounts.state.reward_rate_bps as u64)
            .ok_or(DvpnError::MathOverflow)?
            / 10_000u64;
        node.unclaimed_reward = node
            .unclaimed_reward
            .checked_add(add)
            .ok_or(DvpnError::MathOverflow)?;
        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let amount = ctx.accounts.node.unclaimed_reward;
        require!(amount > 0, DvpnError::NothingToClaim);
        ctx.accounts.node.unclaimed_reward = 0;

        let cpi_accounts = MintTo {
            mint: ctx.accounts.dvpn_mint.to_account_info(),
            to: ctx.accounts.operator_token_account.to_account_info(),
            authority: ctx.accounts.state_signer.to_account_info(),
        };
        let seeds: &[&[u8]] = &[b"state", ctx.accounts.state.authority.as_ref(), &[ctx.accounts.state.bump]];
        let signer = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer);
        token::mint_to(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + State::SIZE,
        seeds = [b"state", authority.key().as_ref()],
        bump
    )]
    pub state: Account<'info, State>,
    /// PDA signer derived from state
    /// CHECK: PDA without data
    #[account(seeds = [b"state", authority.key().as_ref()], bump = bump)]
    pub state_signer: UncheckedAccount<'info>,
    pub dvpn_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAttestor<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
}

#[derive(Accounts)]
pub struct SetMint<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
}

#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(mut, seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    #[account(
        init,
        payer = operator,
        space = 8 + Node::SIZE,
        seeds = [b"node", operator.key().as_ref()],
        bump
    )]
    pub node: Account<'info, Node>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordUsage<'info> {
    /// Attestor authorized by state
    pub attestor: Signer<'info>,
    #[account(mut, seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub node: Account<'info, Node>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    /// CHECK: PDA signer
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, constraint = dvpn_mint.key() == state.mint)]
    pub dvpn_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"node", operator.key().as_ref()], bump)]
    pub node: Account<'info, Node>,
    #[account(mut, associated_token::mint = dvpn_mint, associated_token::authority = operator)]
    pub operator_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
pub struct State {
    pub authority: Pubkey,
    pub attestor: Pubkey,
    pub mint: Pubkey,
    pub reward_rate_bps: u16,
    pub bump: u8,
}

impl State {
    pub const SIZE: usize = 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct Node {
    pub operator: Pubkey,
    pub bandwidth_mbps: u32,
    pub meta_hash: [u8; 32],
    pub stake_lamports: u64,
    pub total_bytes_relayed: u64,
    pub unclaimed_reward: u64,
}

impl Node {
    pub const SIZE: usize = 32 + 4 + 32 + 8 + 8 + 8;
}

#[error_code]
pub enum DvpnError {
    #[msg("Unauthorized")] 
    Unauthorized,
    #[msg("Nothing to claim")] 
    NothingToClaim,
    #[msg("Math overflow")] 
    MathOverflow,
}


