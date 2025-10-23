"use client";

import { useEffect, useState } from "react";

interface BandwidthMonitorProps {
  isConnected: boolean;
}

export function BandwidthMonitor({ isConnected }: BandwidthMonitorProps) {
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [totalData, setTotalData] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setDownloadSpeed(0);
      setUploadSpeed(0);
      return;
    }

    const interval = setInterval(() => {
      // Simulate bandwidth fluctuation
      setDownloadSpeed(Math.random() * 50 + 10);
      setUploadSpeed(Math.random() * 20 + 5);
      setTotalData(prev => prev + (Math.random() * 2 + 0.5));
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const formatSpeed = (mbps: number) => {
    if (mbps < 1) return `${(mbps * 1000).toFixed(0)} KB/s`;
    return `${mbps.toFixed(1)} MB/s`;
  };

  const formatData = (mb: number) => {
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Bandwidth Usage
      </h3>

      <div className="space-y-4">
        {/* Download Speed */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span className="text-slate-300">Download</span>
          </div>
          <span className="text-xl font-bold text-green-500">
            {isConnected ? formatSpeed(downloadSpeed) : '0 KB/s'}
          </span>
        </div>

        {/* Download Bar */}
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300 ease-out"
            style={{ width: isConnected ? `${Math.min((downloadSpeed / 60) * 100, 100)}%` : '0%' }}
          ></div>
        </div>

        {/* Upload Speed */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="text-slate-300">Upload</span>
          </div>
          <span className="text-xl font-bold text-blue-500">
            {isConnected ? formatSpeed(uploadSpeed) : '0 KB/s'}
          </span>
        </div>

        {/* Upload Bar */}
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out"
            style={{ width: isConnected ? `${Math.min((uploadSpeed / 25) * 100, 100)}%` : '0%' }}
          ></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-700">
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-1">Total Data</p>
            <p className="text-2xl font-bold text-white">{formatData(totalData)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-1">Duration</p>
            <p className="text-2xl font-bold text-white font-mono">{formatDuration(duration)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

