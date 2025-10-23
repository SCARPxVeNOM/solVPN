"use client";

import { useState } from "react";

interface ConnectButtonProps {
  isConnected: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export function ConnectButton({ isConnected, onToggle, isLoading = false }: ConnectButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    onToggle();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          relative w-32 h-32 rounded-full transition-all duration-300 ease-out
          ${isConnected 
            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50' 
            : 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50'
          }
          ${isAnimating ? 'scale-95' : 'scale-100'}
          ${isLoading ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
          flex items-center justify-center
          border-4 border-white/20
        `}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
        ) : (
          <svg
            className="w-16 h-16 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isConnected ? (
              // Power off icon
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              // Power on icon
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"
              />
            )}
          </svg>
        )}
        
        {/* Pulse animation when connected */}
        {isConnected && !isLoading && (
          <>
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-pulse"></span>
          </>
        )}
      </button>

      <div className="text-center">
        <p className={`text-2xl font-bold ${isConnected ? 'text-red-500' : 'text-green-500'}`}>
          {isLoading ? 'Connecting...' : isConnected ? 'DISCONNECT' : 'CONNECT'}
        </p>
        <p className="text-slate-400 text-sm mt-1">
          {isConnected ? 'Tap to disconnect from VPN' : 'Tap to connect to VPN'}
        </p>
      </div>
    </div>
  );
}

