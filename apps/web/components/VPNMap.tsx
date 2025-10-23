"use client";

import { useEffect, useRef, useState } from "react";

interface ServerNode {
  id: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  load: number;
  online: boolean;
}

const MOCK_SERVERS: ServerNode[] = [
  { id: "1", country: "USA", city: "New York", lat: 40.7128, lng: -74.0060, load: 45, online: true },
  { id: "2", country: "UK", city: "London", lat: 51.5074, lng: -0.1278, load: 62, online: true },
  { id: "3", country: "Singapore", city: "Singapore", lat: 1.3521, lng: 103.8198, load: 38, online: true },
  { id: "4", country: "Germany", city: "Frankfurt", lat: 50.1109, lng: 8.6821, load: 71, online: true },
  { id: "5", country: "Japan", city: "Tokyo", lat: 35.6762, lng: 139.6503, load: 55, online: true },
  { id: "6", country: "Australia", city: "Sydney", lat: -33.8688, lng: 151.2093, load: 42, online: true },
];

export function VPNMap({ selectedServer, onServerSelect }: { 
  selectedServer: string | null;
  onServerSelect: (serverId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Draw world map (simplified)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let i = 0; i < rect.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, rect.height);
      ctx.stroke();
    }
    for (let i = 0; i < rect.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(rect.width, i);
      ctx.stroke();
    }

    // Draw servers
    MOCK_SERVERS.forEach(server => {
      // Convert lat/lng to canvas coordinates (simplified projection)
      const x = ((server.lng + 180) / 360) * rect.width;
      const y = ((90 - server.lat) / 180) * rect.height;

      const isSelected = server.id === selectedServer;
      const isHovered = server.id === hoveredServer;

      // Draw connection line if selected
      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(rect.width / 2, rect.height / 2);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw server node
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 12 : isHovered ? 10 : 8, 0, Math.PI * 2);
      
      // Color based on load
      const loadColor = server.load < 50 ? "#10b981" : server.load < 70 ? "#f59e0b" : "#ef4444";
      ctx.fillStyle = isSelected ? "#3b82f6" : loadColor;
      ctx.fill();
      
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw pulse animation for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

  }, [selectedServer, hoveredServer]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is near any server
    MOCK_SERVERS.forEach(server => {
      const serverX = ((server.lng + 180) / 360) * rect.width;
      const serverY = ((90 - server.lat) / 180) * rect.height;
      const distance = Math.sqrt((x - serverX) ** 2 + (y - serverY) ** 2);
      
      if (distance < 15) {
        onServerSelect(server.id);
      }
    });
  };

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleCanvasClick}
        style={{ width: "100%", height: "100%" }}
      />
      
      {/* Server tooltips */}
      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-slate-300">Low load (&lt;50%)</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-slate-300">Medium load (50-70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-slate-300">High load (&gt;70%)</span>
        </div>
      </div>
    </div>
  );
}

export { MOCK_SERVERS };
export type { ServerNode };

