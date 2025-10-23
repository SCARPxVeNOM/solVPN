"use client";

import { useState, useEffect } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { VPNMap } from "../../components/VPNMap";
import { ConnectButton } from "../../components/ConnectButton";
import { ServerList } from "../../components/ServerList";
import { BandwidthMonitor } from "../../components/BandwidthMonitor";
import { WalletConnect } from "../../components/WalletConnect";
import { 
  SOLANA_RPC, 
  ATTESTOR_URL,
  fetchSession,
  getNodePda,
  type NodeData 
} from "../../lib/solana";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface ServerNode {
  id: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  load: number;
  online: boolean;
  operator: string;
  bandwidthMbps: number;
}

export default function VPNPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [phantom, setPhantom] = useState<any>(null);
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);

  // Fetch real nodes from blockchain
  useEffect(() => {
    loadNodes();
    const interval = setInterval(loadNodes, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Poll session data when connected
  useEffect(() => {
    if (isConnected && walletAddress && selectedServer) {
      pollSessionData();
      const interval = setInterval(pollSessionData, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, walletAddress, selectedServer]);

  const loadNodes = async () => {
    try {
      const response = await fetch(`${ATTESTOR_URL}/nodes`);
      const data = await response.json();
      
      if (data.ok && data.nodes) {
        // Map blockchain nodes to UI format with mock locations for now
        const mockLocations = [
          { country: "USA", city: "New York", lat: 40.7128, lng: -74.0060 },
          { country: "UK", city: "London", lat: 51.5074, lng: -0.1278 },
          { country: "Singapore", city: "Singapore", lat: 1.3521, lng: 103.8198 },
          { country: "Germany", city: "Frankfurt", lat: 50.1109, lng: 8.6821 },
          { country: "Japan", city: "Tokyo", lat: 35.6762, lng: 139.6503 },
          { country: "Australia", city: "Sydney", lat: -33.8688, lng: 151.2093 },
        ];

        const mappedServers = data.nodes.map((node: any, index: number) => {
          const location = mockLocations[index % mockLocations.length];
          const load = Math.min((node.totalBytesRelayed / 1e9) * 100, 99); // Calculate load from usage
          
          return {
            id: node.pubkey,
            operator: node.operator,
            bandwidthMbps: node.bandwidthMbps,
            load: Math.floor(load),
            online: true,
            ...location,
          };
        });

        setServers(mappedServers);
      }
    } catch (error) {
      console.error("Failed to load nodes:", error);
      // Fallback to empty array on error
      setServers([]);
    }
  };

  const pollSessionData = async () => {
    if (!walletAddress || !selectedServer) return;

    try {
      const connection = new Connection(SOLANA_RPC);
      const userPubkey = new PublicKey(walletAddress);
      const serverInfo = servers.find(s => s.id === selectedServer);
      if (!serverInfo) return;

      const [nodePda] = getNodePda(new PublicKey(serverInfo.operator));
      const session = await fetchSession(connection, userPubkey, new PublicKey(serverInfo.operator));
      
      if (session) {
        setSessionData(session);
        setBytesTransferred(session.bytesUsed);
      }
    } catch (error) {
      console.error("Failed to fetch session data:", error);
    }
  };

  const handleVPNToggle = async () => {
    if (!walletAddress || !phantom) {
      setError("Please connect your wallet first!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!selectedServer) {
      setError("Please select a server!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!isConnected) {
        // START SESSION
        const serverInfo = servers.find(s => s.id === selectedServer);
        if (!serverInfo) throw new Error("Server not found");

        const depositAmount = 1000000; // 0.001 DVPN tokens (adjust based on your decimals)

        const response = await fetch(`${ATTESTOR_URL}/start-session-tx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: walletAddress,
            node: serverInfo.id,
            depositAmount,
          }),
        });

        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "Failed to build transaction");

        // Sign and send via Phantom
        const txBuffer = Buffer.from(data.tx, "base64");
        const signed = await phantom.signAndSendTransaction({
          message: txBuffer,
        });

        setSuccess("Session started! Connecting to VPN...");
        setTimeout(() => setSuccess(null), 3000);
        
        // Connect to WebSocket
        connectToNode(serverInfo.operator);
        
        setIsConnected(true);
      } else {
        // SETTLE SESSION
        const serverInfo = servers.find(s => s.id === selectedServer);
        if (!serverInfo) throw new Error("Server not found");

        const response = await fetch(`${ATTESTOR_URL}/settle-session-tx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: walletAddress,
            node: serverInfo.id,
          }),
        });

        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "Failed to build transaction");

        const txBuffer = Buffer.from(data.tx, "base64");
        await phantom.signAndSendTransaction({
          message: txBuffer,
        });

        setSuccess("Session settled! Tokens transferred to node operator.");
        setTimeout(() => setSuccess(null), 3000);
        
        // Disconnect WebSocket
        if (websocket) {
          websocket.close();
          setWebsocket(null);
        }
        
        setIsConnected(false);
        setSessionData(null);
        setBytesTransferred(0);
      }
    } catch (error: any) {
      console.error("VPN toggle error:", error);
      setError(error.message || "Transaction failed");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const connectToNode = (operatorPubkey: string) => {
    try {
      // Connect to node operator's WebSocket (adjust URL as needed)
      const ws = new WebSocket(`ws://localhost:3001`);
      
      ws.onopen = () => {
        console.log("Connected to VPN node");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.bytes) {
            setBytesTransferred(prev => prev + data.bytes);
          }
        } catch (e) {
          // Handle binary data or echo
          setBytesTransferred(prev => prev + event.data.length);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("Disconnected from VPN node");
      };

      setWebsocket(ws);
    } catch (error) {
      console.error("Failed to connect to node:", error);
    }
  };

  const selectedServerInfo = servers.find(s => s.id === selectedServer);

  const handleWalletChange = (pubkey: string | null, phantomInstance: any) => {
    setWalletAddress(pubkey);
    setPhantom(phantomInstance);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">solVPN</h1>
                <p className="text-xs text-slate-400">Decentralized VPN on Solana</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="/" className="text-slate-400 hover:text-white transition-colors">
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
                  Node Operator →
                </button>
              </a>
              <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                isConnected 
                  ? 'bg-green-500/20 text-green-500 border border-green-500/50' 
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
              }`}>
                {isConnected ? '🟢 Protected' : '🔴 Not Protected'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="fixed top-20 right-6 bg-red-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-lg z-50 animate-slide-in">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed top-20 right-6 bg-green-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-lg z-50 animate-slide-in">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Connection Status Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
              <div className="flex flex-col items-center">
                <ConnectButton
                  isConnected={isConnected}
                  onToggle={handleVPNToggle}
                  isLoading={isLoading}
                />

                {selectedServerInfo && (
                  <div className="mt-6 text-center">
                    <p className="text-slate-400 text-sm mb-2">
                      {isConnected ? "Connected to" : "Selected server"}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl">
                        {selectedServerInfo.country === "USA" && "🇺🇸"}
                        {selectedServerInfo.country === "UK" && "🇬🇧"}
                        {selectedServerInfo.country === "Singapore" && "🇸🇬"}
                        {selectedServerInfo.country === "Germany" && "🇩🇪"}
                        {selectedServerInfo.country === "Japan" && "🇯🇵"}
                        {selectedServerInfo.country === "Australia" && "🇦🇺"}
                      </span>
                      <p className="text-xl font-bold text-white">
                        {selectedServerInfo.city}, {selectedServerInfo.country}
                      </p>
                    </div>
                    {isConnected && sessionData && (
                      <div className="mt-4 text-sm text-slate-400">
                        <p>Deposit: {sessionData.depositAmount / 1e6} DVPN</p>
                        <p>Data used: {(bytesTransferred / 1048576).toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* World Map */}
            <div className="h-96">
              <VPNMap
                selectedServer={selectedServer}
                onServerSelect={setSelectedServer}
              />
            </div>

            {/* Bandwidth Monitor */}
            <BandwidthMonitor 
              isConnected={isConnected}
              bytesTransferred={bytesTransferred}
              websocket={websocket}
              sessionStartTime={sessionData?.startedAt ? sessionData.startedAt * 1000 : 0}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Wallet Connect */}
            <WalletConnect onWalletChange={handleWalletChange} />

            {/* Server List */}
            {servers.length > 0 ? (
              <ServerList
                servers={servers}
                selectedServer={selectedServer}
                onServerSelect={setSelectedServer}
              />
            ) : (
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-slate-400">Loading servers from blockchain...</p>
              </div>
            )}

            {/* Info Card */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-blue-500/30">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How it works
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Connect your Phantom wallet with DVPN tokens</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Select a VPN server from registered nodes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Click CONNECT - tokens deposit to escrow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Use VPN - bandwidth tracked on-chain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Disconnect - tokens paid to node operator</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">
              © 2024 solVPN. Built on Solana. Secured by blockchain.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Program: {walletAddress ? walletAddress.slice(0, 8) + "..." : "Not connected"}</span>
              <span>•</span>
              <span>{servers.length} nodes online</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Animations */}
      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
