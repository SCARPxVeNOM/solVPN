"use client";

import React, { useState } from "react";

export const dynamic = 'force-dynamic';

export default function DemoWireGuard() {
  const [session, setSession] = useState("");
  const [cfg, setCfg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCfg = async () => {
    setLoading(true);
    setError(null);
    try {
      const NODE_AGENT_URL = process.env.NEXT_PUBLIC_NODE_AGENT_URL || "http://localhost:8788";
      const res = await fetch(`${NODE_AGENT_URL}/wg-config?session=${encodeURIComponent(session)}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || res.statusText);
        setLoading(false);
        return;
      }
      const text = await res.text();
      setCfg(text);
    } catch (e: any) {
      setError("Fetch error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCfg = () => {
    if (!cfg) return;
    const blob = new Blob([cfg], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client-wg.conf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">WireGuard VPN Configuration</h1>
        <p className="text-gray-400 mb-6">
          Enter your session PDA (generated via Start Session) and download the WireGuard config.
        </p>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Session PDA
          </label>
          <input
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 2F3kW7x..."
            value={session}
            onChange={(e) => setSession(e.target.value)}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={fetchCfg}
              disabled={loading || !session}
            >
              {loading ? "Fetching..." : "Get WG Config"}
            </button>
            {cfg && (
              <button
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                onClick={downloadCfg}
              >
                Download Config
              </button>
            )}
          </div>
        </div>

        {cfg && (
          <div className="mt-6 bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-3">Configuration Preview</h2>
            <pre className="bg-slate-900 p-4 rounded-lg overflow-auto text-sm text-gray-300">
              {cfg}
            </pre>
          </div>
        )}

        <div className="mt-8 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-bold mb-3">📖 How to Use</h2>
          <ol className="space-y-2 text-gray-300 text-sm">
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">1.</span>
              <span>Start a VPN session on the main page to get a session PDA</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">2.</span>
              <span>Enter the session PDA above and click "Get WG Config"</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">3.</span>
              <span>Download the configuration file</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">4.</span>
              <span>
                Import into WireGuard app or run <code className="bg-slate-900 px-2 py-1 rounded">sudo wg-quick up client-wg.conf</code> on Linux/macOS
              </span>
            </li>
          </ol>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-blue-400 hover:text-blue-300 underline">
            ← Back to Home
          </a>
          {" | "}
          <a href="/vpn" className="text-blue-400 hover:text-blue-300 underline">
            VPN Client →
          </a>
        </div>
      </div>
    </div>
  );
}

