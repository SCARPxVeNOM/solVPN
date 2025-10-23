"use client";

import { useState } from "react";
import { VPNMap, MOCK_SERVERS } from "../../components/VPNMap";
import { ConnectButton } from "../../components/ConnectButton";
import { ServerList } from "../../components/ServerList";
import { BandwidthMonitor } from "../../components/BandwidthMonitor";
import { WalletConnect } from "../../components/WalletConnect";

export default function VPNPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleVPNToggle = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }

    if (!selectedServer) {
      alert("Please select a server!");
      return;
    }

    setIsLoading(true);
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsConnected(!isConnected);
    setIsLoading(false);
  };

  const selectedServerInfo = MOCK_SERVERS.find(s => s.id === selectedServer);

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
                    <p className="text-slate-400 text-sm mb-2">Connected to</p>
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
            <BandwidthMonitor isConnected={isConnected} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Wallet Connect */}
            <WalletConnect onWalletChange={setWalletAddress} />

            {/* Server List */}
            <ServerList
              servers={MOCK_SERVERS}
              selectedServer={selectedServer}
              onServerSelect={setSelectedServer}
            />

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
                  <span>Connect your Phantom wallet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Select a VPN server location</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Click connect to start secure session</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">✓</span>
                  <span>Pay with DVPN tokens automatically</span>
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
            <div className="flex items-center gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.840 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.430.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
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

