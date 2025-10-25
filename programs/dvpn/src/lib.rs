use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
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

    pub fn register_node(ctx: Context<RegisterNode>, stake_lamports: u64, bandwidth_mbps: u32, meta_hash: [u8; 32], wg_pubkey: Option<[u8; 32]>) -> Result<()> {
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
        node.wg_pubkey = wg_pubkey.unwrap_or([0; 32]);
        node.rating_sum = 0;
        node.rating_count = 0;
        node.active = true;
        node.registered_at = Clock::get()?.unix_timestamp;
        node.last_slash_ts = 0;
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

    /// Faucet: Mint tokens to user for testing (devnet only)
    pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
        // Only attestor can call faucet
        require_keys_eq!(ctx.accounts.state.attestor, ctx.accounts.attestor.key(), DvpnError::Unauthorized);
        
        let cpi_accounts = MintTo {
            mint: ctx.accounts.dvpn_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.state_signer.to_account_info(),
        };
        let seeds: &[&[u8]] = &[b"state", ctx.accounts.state.authority.as_ref(), &[ctx.accounts.state.bump]];
        let signer = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer);
        token::mint_to(cpi_ctx, amount)?;
        Ok(())
    }

    /// Start a new VPN session with escrow deposit
    pub fn start_session(ctx: Context<StartSession>, deposit_amount: u64) -> Result<()> {
        let session = &mut ctx.accounts.session;
        session.user = ctx.accounts.user.key();
        session.node = ctx.accounts.node.key();
        session.deposit_amount = deposit_amount;
        session.bytes_used = 0;
        session.started_at = Clock::get()?.unix_timestamp;
        session.closed = false;
        session.bump = ctx.bumps.session;
        
        emit!(SessionStarted {
            session: session.key(),
            user: session.user,
            node: session.node,
            deposit: deposit_amount,
        });
        Ok(())
    }

    /// Submit bandwidth usage for a session (attestor only)
    pub fn submit_usage(ctx: Context<SubmitUsage>, bytes: u64) -> Result<()> {
        require_keys_eq!(ctx.accounts.state.attestor, ctx.accounts.attestor.key(), DvpnError::Unauthorized);
        let session = &mut ctx.accounts.session;
        require!(!session.closed, DvpnError::SessionClosed);
        
        session.bytes_used = session.bytes_used
            .checked_add(bytes)
            .ok_or(DvpnError::MathOverflow)?;
        
        emit!(UsageSubmitted {
            session: session.key(),
            bytes: session.bytes_used,
        });
        Ok(())
    }

    /// Settle session and transfer tokens from escrow to node operator
    pub fn settle_session(ctx: Context<SettleSession>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, DvpnError::SessionClosed);

        let node = &ctx.accounts.node;
        let price_per_mb = node.bandwidth_mbps as u64; // simplified pricing
        
        // Calculate payout: (bytes_used / 1_048_576) * price_per_mb
        let payout = (session.bytes_used as u128)
            .checked_mul(price_per_mb as u128)
            .ok_or(DvpnError::MathOverflow)?
            / 1_048_576u128;
        
        let payout_u64 = payout.min(session.deposit_amount as u128) as u64;
        
        // Protocol fee (1%)
        let protocol_fee = payout_u64 / 100;
        let node_amount = payout_u64.saturating_sub(protocol_fee);

        // Store values before closing to avoid borrow conflicts
        let session_key = session.key();
        let bytes_used = session.bytes_used;
        let user_key = session.user;
        let node_key = session.node;
        let bump = session.bump;

        // Mark session as closed
        session.closed = true;

        // Transfer tokens from escrow PDA to node operator's token account
        let seeds: &[&[u8]] = &[
            b"escrow",
            user_key.as_ref(),
            node_key.as_ref(),
            &[bump]
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.node_token_account.to_account_info(),
            authority: ctx.accounts.session.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::transfer(cpi_ctx, node_amount)?;
        
        emit!(SessionSettled {
            session: session_key,
            payout: node_amount,
            bytes: bytes_used,
        });
        Ok(())
    }

    /// Settle session with ZK proof attestation
    pub fn settle_session_with_attestation(
        ctx: Context<SettleWithAttestation>,
        total_bytes: u64,
        attestor_pubkey: Pubkey,
        _attestor_sig: Vec<u8>,
    ) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, DvpnError::SessionClosed);

        // Verify attestor matches state
        require_keys_eq!(ctx.accounts.state.attestor, attestor_pubkey, DvpnError::Unauthorized);

        // Update session bytes
        session.bytes_used = total_bytes;

        let node = &ctx.accounts.node;
        let price_per_mb = node.bandwidth_mbps as u64;
        
        // Calculate payout
        let payout = (total_bytes as u128)
            .checked_mul(price_per_mb as u128)
            .ok_or(DvpnError::MathOverflow)?
            / 1_048_576u128;
        
        let payout_u64 = payout.min(session.deposit_amount as u128) as u64;
        let protocol_fee = payout_u64 / 100;
        let node_amount = payout_u64.saturating_sub(protocol_fee);

        // Store values before closing to avoid borrow conflicts
        let session_key = session.key();
        let user_key = session.user;
        let node_key = session.node;
        let bump = session.bump;

        // Mark session as closed
        session.closed = true;

        // Transfer tokens
        let seeds: &[&[u8]] = &[
            b"escrow",
            user_key.as_ref(),
            node_key.as_ref(),
            &[bump]
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.node_token_account.to_account_info(),
            authority: ctx.accounts.session.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer
        );
        token::transfer(cpi_ctx, node_amount)?;
        
        emit!(SessionSettled {
            session: session_key,
            payout: node_amount,
            bytes: total_bytes,
        });
        Ok(())
    }

    /// Slash node for misbehavior
    pub fn slash_node(ctx: Context<SlashNode>, amount: u64, _reason: String) -> Result<()> {
        require_keys_eq!(ctx.accounts.state.attestor, ctx.accounts.authority.key(), DvpnError::Unauthorized);
        
        let node = &mut ctx.accounts.node;
        if node.stake_lamports < amount {
            node.stake_lamports = 0;
        } else {
            node.stake_lamports = node.stake_lamports
                .checked_sub(amount)
                .ok_or(DvpnError::MathOverflow)?;
        }
        node.last_slash_ts = Clock::get()?.unix_timestamp;
        
        emit!(NodeSlashed { 
            node: node.key(), 
            amount,
        });
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

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub attestor: Signer<'info>,
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    /// CHECK: PDA signer (mint authority)
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, constraint = dvpn_mint.key() == state.mint)]
    pub dvpn_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StartSession<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Session::SIZE,
        seeds = [b"session", user.key().as_ref(), node.key().as_ref()],
        bump
    )]
    pub session: Account<'info, Session>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub node: Account<'info, Node>,
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitUsage<'info> {
    pub attestor: Signer<'info>,
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    #[account(mut, has_one = user)]
    pub session: Account<'info, Session>,
    /// CHECK: Session user for validation
    pub user: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SettleSession<'info> {
    #[account(mut, has_one = node, has_one = user)]
    pub session: Account<'info, Session>,
    #[account(mut)]
    pub node: Account<'info, Node>,
    /// CHECK: Session user
    pub user: UncheckedAccount<'info>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub node_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleWithAttestation<'info> {
    #[account(mut, has_one = node, has_one = user)]
    pub session: Account<'info, Session>,
    #[account(mut)]
    pub node: Account<'info, Node>,
    /// CHECK: Session user
    pub user: UncheckedAccount<'info>,
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub node_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SlashNode<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"state", state.authority.as_ref()], bump = state.bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub node: Account<'info, Node>,
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
    pub wg_pubkey: [u8; 32],
    pub rating_sum: u64,
    pub rating_count: u32,
    pub active: bool,
    pub registered_at: i64,
    pub last_slash_ts: i64,
}

impl Node {
    pub const SIZE: usize = 32 + 4 + 32 + 8 + 8 + 8 + 32 + 8 + 4 + 1 + 8 + 8;
}

#[account]
pub struct Session {
    pub user: Pubkey,
    pub node: Pubkey,
    pub deposit_amount: u64,
    pub bytes_used: u64,
    pub started_at: i64,
    pub closed: bool,
    pub bump: u8,
}

impl Session {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[event]
pub struct SessionStarted {
    pub session: Pubkey,
    pub user: Pubkey,
    pub node: Pubkey,
    pub deposit: u64,
}

#[event]
pub struct UsageSubmitted {
    pub session: Pubkey,
    pub bytes: u64,
}

#[event]
pub struct SessionSettled {
    pub session: Pubkey,
    pub payout: u64,
    pub bytes: u64,
}

#[event]
pub struct NodeSlashed {
    pub node: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum DvpnError {
    #[msg("Unauthorized")] 
    Unauthorized,
    #[msg("Nothing to claim")] 
    NothingToClaim,
    #[msg("Math overflow")] 
    MathOverflow,
    #[msg("Session already closed")]
    SessionClosed,
}


