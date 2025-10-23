"use client";

import { ServerNode } from "./VPNMap";

interface ServerListProps {
  servers: ServerNode[];
  selectedServer: string | null;
  onServerSelect: (serverId: string) => void;
}

export function ServerList({ servers, selectedServer, onServerSelect }: ServerListProps) {
  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        Available Servers
      </h3>

      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => onServerSelect(server.id)}
            className={`
              w-full p-4 rounded-xl transition-all duration-200
              ${selectedServer === server.id
                ? 'bg-blue-600 border-2 border-blue-400'
                : 'bg-slate-700 border-2 border-transparent hover:border-slate-600'
              }
              flex items-center justify-between group
            `}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  server.load < 50 ? 'bg-green-500/20' : server.load < 70 ? 'bg-amber-500/20' : 'bg-red-500/20'
                }`}>
                  <span className="text-xl">
                    {server.country === "USA" && "🇺🇸"}
                    {server.country === "UK" && "🇬🇧"}
                    {server.country === "Singapore" && "🇸🇬"}
                    {server.country === "Germany" && "🇩🇪"}
                    {server.country === "Japan" && "🇯🇵"}
                    {server.country === "Australia" && "🇦🇺"}
                  </span>
                </div>
                {server.online && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></span>
                )}
              </div>

              <div className="text-left">
                <p className="font-semibold text-white">{server.city}</p>
                <p className="text-xs text-slate-400">{server.country}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Load indicator */}
              <div className="flex flex-col items-end">
                <span className={`text-xs font-semibold ${
                  server.load < 50 ? 'text-green-500' : server.load < 70 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {server.load}%
                </span>
                <div className="w-16 h-1.5 bg-slate-600 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${
                      server.load < 50 ? 'bg-green-500' : server.load < 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${server.load}%` }}
                  ></div>
                </div>
              </div>

              {/* Selection indicator */}
              <svg
                className={`w-6 h-6 transition-all ${
                  selectedServer === server.id ? 'text-white opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-50'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

