"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getTokenBalance, fetchState, SOLANA_RPC } from "../lib/solana";

interface WalletConnectProps {
  onWalletChange: (publicKey: string | null, phantom: any) => void;
}

export function WalletConnect({ onWalletChange }: WalletConnectProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [phantom, setPhantom] = useState<any>(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  useEffect(() => {
    if (walletAddress) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 10000); // Update every 10s
      return () => clearInterval(interval);
    }
  }, [walletAddress]);

  const fetchBalances = async () => {
    if (!walletAddress) return;
    
    try {
      const connection = new Connection(SOLANA_RPC);
      const pubkey = new PublicKey(walletAddress);
      
      // Fetch SOL balance
      const sol = await connection.getBalance(pubkey);
      setSolBalance(sol / 1e9);
      
      // Fetch DVPN token balance
      const state = await fetchState(connection, pubkey);
      if (state?.mint) {
        const tokenBal = await getTokenBalance(connection, pubkey, state.mint);
        setBalance(tokenBal);
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const checkWalletConnection = async () => {
    try {
      const { solana } = window as any;
      if (solana?.isPhantom) {
        setPhantom(solana);
        if (solana.isConnected) {
          const publicKey = solana.publicKey.toString();
          setWalletAddress(publicKey);
          onWalletChange(publicKey, solana);
        }
      }
    } catch (error) {
      console.error("Error checking wallet:", error);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const { solana } = window as any;
      
      if (!solana?.isPhantom) {
        alert("Please install Phantom wallet!");
        window.open("https://phantom.app/", "_blank");
        setIsConnecting(false);
        return;
      }

      const response = await solana.connect();
      const publicKey = response.publicKey.toString();
      setWalletAddress(publicKey);
      setPhantom(solana);
      onWalletChange(publicKey, solana);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      const { solana } = window as any;
      await solana?.disconnect();
      setWalletAddress(null);
      setBalance(0);
      setSolBalance(0);
      setPhantom(null);
      onWalletChange(null, null);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (walletAddress) {
    return (
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 border border-purple-400/30 shadow-lg shadow-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p className="text-white/80 text-xs">Phantom Wallet</p>
              <p className="text-white font-mono text-sm font-semibold">{truncateAddress(walletAddress)}</p>
            </div>
          </div>
          
          <button
            onClick={disconnectWallet}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all backdrop-blur-sm"
          >
            Disconnect
          </button>
        </div>

        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
          <p className="text-white/70 text-xs mb-1">DVPN Balance</p>
          <p className="text-3xl font-bold text-white">{balance.toFixed(2)} <span className="text-lg text-white/80">DVPN</span></p>
          <p className="text-white/60 text-xs mt-1">≈ ${(balance * 0.5).toFixed(2)} USD</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
        <p className="text-slate-400 text-sm mb-6">
          Connect your Phantom wallet to use solVPN
        </p>

        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/30"
        >
          {isConnecting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Connecting...
            </span>
          ) : (
            'Connect Phantom'
          )}
        </button>
      </div>
    </div>
  );
}

