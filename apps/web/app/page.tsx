"use client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { useMemo, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const ATTESTOR_URL = "http://localhost:8787";
const PROGRAM_ID = "8j3TUcbSuaq5BVNSf5GJhgucwrswH432sqJNxCoym8hB";

function Dashboard() {
  const { publicKey } = useWallet();
  const [tab, setTab] = useState<"register" | "state" | "claim">("register");
  const [stakeLamports, setStakeLamports] = useState("100000000"); // 0.1 SOL
  const [bandwidthMbps, setBandwidthMbps] = useState("100");
  const [metaHash, setMetaHash] = useState("0000000000000000000000000000000000000000000000000000000000000000");
  const [registerResult, setRegisterResult] = useState("");
  const [stateData, setStateData] = useState<any>(null);
  const [claimResult, setClaimResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [phantomDetected, setPhantomDetected] = useState(false);
  const [walletError, setWalletError] = useState("");

  useEffect(() => {
    try {
      const has = typeof window !== "undefined" && (window as any)?.phantom?.solana?.isPhantom;
      setPhantomDetected(!!has);
    } catch {
      setPhantomDetected(false);
    }
  }, []);

  const handleDirectPhantomConnect = async () => {
    setWalletError("");
    try {
      // Fallback direct connect for debugging Phantom detection issues
      const p = (window as any)?.phantom?.solana;
      if (!p) {
        setWalletError("Phantom not detected. Please install the Phantom extension.");
        return;
      }
      await p.connect({ onlyIfTrusted: false });
    } catch (e: any) {
      setWalletError(e?.message || "Failed to connect to Phantom");
    }
  };

  const handleRegister = async () => {
    if (!publicKey) return;
    setLoading(true);
    setRegisterResult("");
    try {
      const metaHashBytes = Array.from(Buffer.from(metaHash.slice(0, 64), "hex"));
      const res = await fetch(`${ATTESTOR_URL}/register-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator: publicKey.toBase58(),
          stakeLamports: stakeLamports,
          bandwidthMbps: parseInt(bandwidthMbps),
          metaHash: metaHashBytes,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "failed to build tx");
      const txB64 = data.tx as string;
      // Request wallet to sign and send
      const p = (window as any)?.phantom?.solana;
      if (!p) throw new Error("Phantom not available");
      const signed = await p.signAndSendTransaction(txB64);
      setRegisterResult(`✅ Node registered! TX: ${signed.signature || signed}`);
    } catch (err: any) {
      setRegisterResult(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchState = async () => {
    setLoading(true);
    setStateData(null);
    try {
      const res = await fetch(`${ATTESTOR_URL}/state`);
      const data = await res.json();
      setStateData(data);
    } catch (err: any) {
      setStateData({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey) return;
    setLoading(true);
    setClaimResult("");
    try {
      const res = await fetch(`${ATTESTOR_URL}/claim-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "failed to build tx");
      const txB64 = data.tx as string;
      const p = (window as any)?.phantom?.solana;
      if (!p) throw new Error("Phantom not available");
      const signed = await p.signAndSendTransaction(txB64);
      setClaimResult(`✅ Rewards claimed! TX: ${signed.signature || signed}`);
    } catch (err: any) {
      setClaimResult(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setTab("register")}
          className={`px-4 py-2 rounded ${tab === "register" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >
          Register Node
        </button>
        <button
          onClick={() => setTab("state")}
          className={`px-4 py-2 rounded ${tab === "state" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >
          View State
        </button>
        <button
          onClick={() => setTab("claim")}
          className={`px-4 py-2 rounded ${tab === "claim" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >
          Claim Rewards
        </button>
      </div>

      {tab === "register" && (
        <div className="bg-gray-900 p-6 rounded space-y-4">
          <h2 className="text-xl font-semibold">Register Your Node</h2>
          <div className="text-sm text-gray-400">
            Wallet: {publicKey ? (
              <span className="text-green-400">{publicKey.toBase58()}</span>
            ) : (
              <span className="text-yellow-400">Not connected</span>
            )}
          </div>
          {!publicKey && (
            <div className="text-sm text-gray-300 bg-gray-800 p-3 rounded">
              {phantomDetected ? (
                <>
                  Having trouble with the modal? Try the fallback:
                  <button onClick={handleDirectPhantomConnect} className="ml-2 px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded">Direct Phantom Connect</button>
                </>
              ) : (
                <>
                  Phantom not detected. Install it from <a className="underline text-blue-400" href="https://phantom.app/" target="_blank" rel="noreferrer">phantom.app</a>
                </>
              )}
              {walletError && <div className="mt-2 text-red-400">{walletError}</div>}
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Operator Pubkey</label>
            <input
              type="text"
              value={publicKey?.toBase58() || "Connect wallet first"}
              disabled
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Stake (lamports)</label>
            <input
              type="text"
              value={stakeLamports}
              onChange={(e) => setStakeLamports(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">Default: 100000000 (0.1 SOL)</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Bandwidth (Mbps)</label>
            <input
              type="text"
              value={bandwidthMbps}
              onChange={(e) => setBandwidthMbps(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Meta Hash (64 hex chars)</label>
            <input
              type="text"
              value={metaHash}
              onChange={(e) => setMetaHash(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={!publicKey || loading}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded"
          >
            {loading ? "Registering..." : "Register Node"}
          </button>
          {registerResult && <pre className="text-sm mt-2 p-3 bg-gray-800 rounded">{registerResult}</pre>}
        </div>
      )}

      {tab === "state" && (
        <div className="bg-gray-900 p-6 rounded space-y-4">
          <h2 className="text-xl font-semibold">Program State</h2>
          <p className="text-sm text-gray-400">Program ID: {PROGRAM_ID}</p>
          <button
            onClick={handleFetchState}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded"
          >
            {loading ? "Fetching..." : "Fetch State"}
          </button>
          {stateData && (
            <pre className="text-sm p-4 bg-gray-800 rounded overflow-auto max-h-96">
              {JSON.stringify(stateData, null, 2)}
            </pre>
          )}
        </div>
      )}

      {tab === "claim" && (
        <div className="bg-gray-900 p-6 rounded space-y-4">
          <h2 className="text-xl font-semibold">Claim Rewards</h2>
          <p className="text-sm text-gray-400">
            Click below to claim any unclaimed DVPN token rewards for your operator account.
          </p>
          <div>
            <label className="block text-sm mb-1">Operator Pubkey</label>
            <input
              type="text"
              value={publicKey?.toBase58() || "Connect wallet first"}
              disabled
              className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            />
          </div>
          <button
            onClick={handleClaim}
            disabled={!publicKey || loading}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 rounded"
          >
            {loading ? "Claiming..." : "Claim Rewards"}
          </button>
          {claimResult && <pre className="text-sm mt-2 p-3 bg-gray-800 rounded">{claimResult}</pre>}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const endpoint = "https://api.devnet.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">solVPN Node Operator</h1>
        <a href="/vpn" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30">
          🌐 Open VPN Client
        </a>
      </div>
      {mounted ? (
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <div className="flex justify-end" suppressHydrationWarning>
                <WalletMultiButton />
              </div>
              <Dashboard />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      ) : (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      )}
    </main>
  );
}


