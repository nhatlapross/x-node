"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize, Minimize, HelpCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as THREE from "three";

// Types for our nodes and connections
export interface GlobeNode {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: "online" | "offline" | "loading";
  size: number;
  color: string;
  // Additional data for details panel
  version?: string;
  cpu?: number;
  ram?: number;
  storage?: number;
  uptime?: number;
  peers?: number;
  pubkey?: string | null;
}

export interface GlobeConnection {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

interface GlobeVisualizationProps {
  nodes: GlobeNode[];
  connections: GlobeConnection[];
  isDark: boolean;
}

// Dynamically import Globe to avoid SSR issues
const Globe = dynamic(
  () => import("react-globe.gl").then((mod) => mod.default),
  { ssr: false }
);

export function GlobeVisualization({
  nodes,
  connections,
  isDark,
}: GlobeVisualizationProps) {
  const globeEl = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "offline"
  >("all");
  const [showConnections, setShowConnections] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GlobeNode | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (globeEl.current) {
      // Auto-rotate the globe
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;

      // Center the globe properly
      globeEl.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
    }
  }, [mounted]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Apply filters
  const filteredNodes = nodes.filter((node) => {
    if (statusFilter !== "all" && node.status !== statusFilter) return false;
    return true;
  });

  // Filter and modify connections based on selection
  const filteredConnections = showConnections
    ? selectedNode
      ? connections.map((conn) => {
          // Check if connection involves selected node
          const isRelevant =
            (conn.startLat === selectedNode.lat &&
              conn.startLng === selectedNode.lng) ||
            (conn.endLat === selectedNode.lat &&
              conn.endLng === selectedNode.lng);

          // Dim non-relevant connections
          if (!isRelevant) {
            return {
              ...conn,
              color: "#333333", // Very dim grey
            };
          }
          return conn;
        })
      : connections
    : [];

  // Format uptime helper
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Handle node click
  const handleNodeClick = (node: any) => {
    const globeNode = filteredNodes.find((n) => n.id === node.id);
    if (globeNode) {
      setSelectedNode(selectedNode?.id === globeNode.id ? null : globeNode);
    }
  };

  // Get peer node IDs for selected node
  const peerNodeIds = new Set<string>();
  if (selectedNode) {
    connections.forEach((conn) => {
      // Find connections involving the selected node
      const selectedLat = selectedNode.lat;
      const selectedLng = selectedNode.lng;

      if (conn.startLat === selectedLat && conn.startLng === selectedLng) {
        // Find node at end of connection
        const peerNode = nodes.find(
          (n) => n.lat === conn.endLat && n.lng === conn.endLng
        );
        if (peerNode) peerNodeIds.add(peerNode.id);
      } else if (conn.endLat === selectedLat && conn.endLng === selectedLng) {
        // Find node at start of connection
        const peerNode = nodes.find(
          (n) => n.lat === conn.startLat && n.lng === conn.startLng
        );
        if (peerNode) peerNodeIds.add(peerNode.id);
      }
    });
  }

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-muted-foreground">Loading Globe...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{
        background: isDark
          ? "#0a0a0a"
          : "linear-gradient(to bottom, #1e3a8a 0%, #3b82f6 30%, #60a5fa 60%, #93c5fd 100%)",
      }}
    >
      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="bg-background/95 backdrop-blur"
        >
          <Filter className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowHelp(!showHelp)}
          className="bg-background/95 backdrop-blur"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          className="bg-background/95 backdrop-blur"
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-16 right-4 z-10 bg-background/95 backdrop-blur border border-border rounded-lg p-4 text-xs font-mono min-w-[200px]">
          <div className="font-bold mb-3 text-sm">Filters</div>

          {/* Status Filter */}
          <div className="mb-3">
            <div className="text-muted-foreground mb-2">Node Status</div>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("online")}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  statusFilter === "online"
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Online
              </button>
              <button
                onClick={() => setStatusFilter("offline")}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  statusFilter === "offline"
                    ? "bg-red-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Offline
              </button>
            </div>
          </div>

          {/* Toggle Connections */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showConnections}
                onChange={(e) => setShowConnections(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-muted-foreground">Show Connections</span>
            </label>
          </div>

          {/* Stats */}
          <div className="mt-3 pt-3 border-t border-border text-muted-foreground text-xs">
            Showing {filteredNodes.length} of {nodes.length} nodes
          </div>
        </div>
      )}

      {/* Help Tooltip */}
      {showHelp && (
        <div className="absolute top-16 right-4 z-10 bg-background/95 backdrop-blur border border-border rounded-lg p-4 text-xs font-mono max-w-xs">
          <div className="font-bold mb-2 text-sm">Connection Types</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-0.5 shadow-[0_0_4px_rgba(0,255,255,0.8)]"
                style={{ backgroundColor: "#00ffff" }}
              />
              <span className="text-muted-foreground">
                Bidirectional (Active)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-0.5"
                style={{ backgroundColor: "#0099ff" }}
              />
              <span className="text-muted-foreground">Bidirectional</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-0.5"
                style={{ backgroundColor: "#ffdd00" }}
              />
              <span className="text-muted-foreground">
                Unidirectional (Active)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gray-500" />
              <span className="text-muted-foreground">Unidirectional</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border text-muted-foreground">
            Active connections: Last seen &lt; 5 minutes
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            <span className="text-muted-foreground">Online (latest)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
            <span className="text-muted-foreground">Online (older)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-muted-foreground">Offline</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border text-muted-foreground">
          {filteredNodes.length} nodes • {filteredConnections.length}{" "}
          connections
        </div>
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-background/95 backdrop-blur border border-border rounded-lg p-4 text-xs font-mono max-w-sm">
          <div className="flex justify-between items-start mb-3">
            <div
              className="font-bold text-sm"
              style={{ color: selectedNode.color }}
            >
              {selectedNode.label}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span
                style={{ color: selectedNode.color }}
                className="font-medium"
              >
                {selectedNode.status}
              </span>
            </div>

            {selectedNode.version && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <span className="text-foreground">{selectedNode.version}</span>
              </div>
            )}

            {selectedNode.cpu !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU:</span>
                <span className="text-foreground">
                  {selectedNode.cpu.toFixed(2)}%
                </span>
              </div>
            )}

            {selectedNode.ram !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">RAM:</span>
                <span className="text-foreground">
                  {selectedNode.ram.toFixed(1)}%
                </span>
              </div>
            )}

            {selectedNode.storage !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage:</span>
                <span className="text-foreground">
                  {(selectedNode.storage / 1024 / 1024 / 1024).toFixed(2)} GB
                </span>
              </div>
            )}

            {selectedNode.uptime !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime:</span>
                <span className="text-foreground">
                  {formatUptime(selectedNode.uptime)}
                </span>
              </div>
            )}

            {selectedNode.peers !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peers:</span>
                <span className="text-foreground">{selectedNode.peers}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Connected:</span>
              <span className="text-foreground">
                {peerNodeIds.size} visible
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Coords:</span>
              <span className="text-foreground">
                {selectedNode.lat.toFixed(2)}, {selectedNode.lng.toFixed(2)}
              </span>
            </div>

            {selectedNode.pubkey && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">Public Key:</div>
                <div className="text-foreground break-all text-[10px]">
                  {selectedNode.pubkey}
                </div>
              </div>
            )}
          </div>

          {peerNodeIds.size > 0 && (
            <div className="mt-3 pt-3 border-t border-border text-muted-foreground text-[10px] italic">
              Highlighted: {peerNodeIds.size} peer node
              {peerNodeIds.size > 1 ? "s" : ""} • Click ✕ or another node to
              reset
            </div>
          )}
        </div>
      )}

      <Globe
        ref={globeEl}
        // Globe appearance - Beautiful with stars
        globeImageUrl={
          isDark
            ? "//unpkg.com/three-globe/example/img/earth-night.jpg"
            : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        }
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl={
          isDark ? "//unpkg.com/three-globe/example/img/night-sky.png" : null
        }
        backgroundColor={isDark ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)"}
        // Custom Objects (Nodes) - Square shapes using objects layer
        objectsData={filteredNodes}
        objectLat={(d: any) => d.lat}
        objectLng={(d: any) => d.lng}
        objectAltitude={0.01}
        objectLabel={(d: any) => `
          <div style="
            background: ${
              isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.95)"
            };
            color: ${isDark ? "#fff" : "#000"};
            padding: 10px 14px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 13px;
            border: 2px solid ${d.color};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; color: ${
              d.color
            };">${d.label}</div>
            <div style="opacity: 0.9;">Status: <span style="color: ${
              d.color
            };">${d.status}</span></div>
            <div style="opacity: 0.7; font-size: 11px; margin-top: 4px;">Coords: ${d.lat.toFixed(
              2
            )}, ${d.lng.toFixed(2)}</div>
          </div>
        `}
        // Custom THREE.js object for square nodes with strong glow
        objectThreeObject={(node: any) => {
          const size = Math.max(0.4, node.size * 0.6);

          // Determine if node should be dimmed
          const isSelected = selectedNode?.id === node.id;
          const isPeer = selectedNode && peerNodeIds.has(node.id);
          const shouldDim = selectedNode && !isSelected && !isPeer;

          // Adjust opacity based on selection state
          const coreOpacity = shouldDim ? 0.15 : 1;
          const glow1Opacity = shouldDim
            ? 0.1
            : isSelected || isPeer
            ? 0.7
            : 0.5;
          const glow2Opacity = shouldDim
            ? 0.05
            : isSelected || isPeer
            ? 0.4
            : 0.2;

          // Core bright cube
          const geometry = new THREE.BoxGeometry(size, size, size);
          const material = new THREE.MeshBasicMaterial({
            color: node.color,
            transparent: shouldDim,
            opacity: coreOpacity,
          });
          const mesh = new THREE.Mesh(geometry, material);

          // Inner glow layer
          const glowGeometry1 = new THREE.BoxGeometry(
            size * 1.4,
            size * 1.4,
            size * 1.4
          );
          const glowMaterial1 = new THREE.MeshBasicMaterial({
            color: node.color,
            transparent: true,
            opacity: glow1Opacity,
          });
          const glow1 = new THREE.Mesh(glowGeometry1, glowMaterial1);

          // Outer glow layer - bigger for selected/peer nodes
          const outerSize = isSelected || isPeer ? size * 2.2 : size * 1.8;
          const glowGeometry2 = new THREE.BoxGeometry(
            outerSize,
            outerSize,
            outerSize
          );
          const glowMaterial2 = new THREE.MeshBasicMaterial({
            color: node.color,
            transparent: true,
            opacity: glow2Opacity,
          });
          const glow2 = new THREE.Mesh(glowGeometry2, glowMaterial2);

          const group = new THREE.Group();
          group.add(glow2); // Outermost
          group.add(glow1); // Middle
          group.add(mesh); // Core

          return group;
        }}
        // Arcs (Connections) - Enhanced visibility
        arcsData={filteredConnections}
        arcStartLat={(d: any) => d.startLat}
        arcStartLng={(d: any) => d.startLng}
        arcEndLat={(d: any) => d.endLat}
        arcEndLng={(d: any) => d.endLng}
        arcColor={(d: any) => d.color}
        arcDashLength={0.03}
        arcDashGap={0.02}
        arcDashAnimateTime={8000}
        arcStroke={0.3} // Thin, elegant lines
        arcAltitude={0.1} // Moderate arc height
        arcAltitudeAutoScale={0.2}
        // Atmosphere - Subtle but visible
        atmosphereColor={isDark ? "#3a7ebf" : "#60a5fa"}
        atmosphereAltitude={0.2}
        // Enable clouds for extra beauty
        showAtmosphere={true}
        // Click handler for nodes
        onObjectClick={handleNodeClick}
        // Click on globe background to deselect
        onGlobeClick={() => setSelectedNode(null)}
        // Performance
        rendererConfig={{ antialias: true, alpha: true }}
      />
    </div>
  );
}
