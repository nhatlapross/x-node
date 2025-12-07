"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";

// Dynamic import to avoid SSR issues with Three.js
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="text-zinc-400">Loading 3D Graph...</div>
    </div>
  ),
});

// Glow colors for different states
const GLOW_COLORS = {
  online_latest: { core: "#00ff88", emissive: 0x00ff88 },
  online_older: { core: "#ffaa00", emissive: 0xffaa00 },
  offline: { core: "#ff3366", emissive: 0xff3366 },
};

// Cache geometries and materials for performance
const geometryCache = new Map<string, THREE.SphereGeometry>();
const materialCache = new Map<number, THREE.MeshBasicMaterial>();

const getCachedGeometry = (radius: number, segments: number = 16): THREE.SphereGeometry => {
  const key = `${radius}-${segments}`;
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.SphereGeometry(radius, segments, segments));
  }
  return geometryCache.get(key)!;
};

const getCachedMaterial = (color: number, opacity: number = 1): THREE.MeshBasicMaterial => {
  const key = color * 1000 + Math.round(opacity * 100);
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshBasicMaterial({
      color: color,
      transparent: opacity < 1,
      opacity: opacity,
    }));
  }
  return materialCache.get(key)!;
};

// Types
interface PodInfo {
  address: string;
  pubkey?: string | null;
  version: string;
  last_seen_timestamp: number;
}

interface NodeData {
  address: string;
  pubkey: string | null;
  status: "online" | "offline" | "loading";
  version?: { version: string };
  stats?: {
    cpu_percent: number;
    ram_used: number;
    ram_total: number;
    uptime: number;
    active_streams: number;
    current_index: number;
  };
  pods?: {
    pods: PodInfo[];
    total_count: number;
  };
}

interface GraphNode {
  id: string;
  name: string;
  pubkey: string | null;
  version: string;
  status: "online" | "offline" | "loading";
  peerCount: number;
  cpu?: number;
  uptime?: number;
  syncIndex?: number;
  val: number; // Node size
  color: string;
  // Position properties added by force simulation
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

interface GraphLink {
  source: string;
  target: string;
  bidirectional: boolean;
  isActive: boolean;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface NetworkTopology3DProps {
  nodes: NodeData[];
  onNodeClick?: (node: NodeData) => void;
}

export function NetworkTopology3D({ nodes, onNodeClick }: NetworkTopology3DProps) {
  const fgRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Store node positions to preserve them across updates
  const nodePositionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());

  // Stop auto-rotate when user interacts with the graph
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stopAutoRotate = () => {
      if (autoRotate) {
        setAutoRotate(false);
      }
    };

    // Listen for user interactions
    container.addEventListener("mousedown", stopAutoRotate);
    container.addEventListener("wheel", stopAutoRotate);
    container.addEventListener("touchstart", stopAutoRotate);

    return () => {
      container.removeEventListener("mousedown", stopAutoRotate);
      container.removeEventListener("wheel", stopAutoRotate);
      container.removeEventListener("touchstart", stopAutoRotate);
    };
  }, [autoRotate]);

  // Build graph data from nodes (only include nodes that are not loading)
  // Preserves positions of existing nodes
  const buildGraphData = useCallback((nodesList: NodeData[]): GraphData => {
    const graphNodes: GraphNode[] = [];
    const graphLinks: GraphLink[] = [];
    const linkSet = new Set<string>();

    // Filter: only show nodes that have finished loading (online or offline)
    const loadedNodes = nodesList.filter(n => n.status !== "loading");

    // Create nodes - preserve positions for existing nodes
    loadedNodes.forEach((node) => {
      const peerCount = node.pods?.total_count || 0;
      const isOnline = node.status === "online";

      // Get existing position or create new node at random position around center
      const existingPos = nodePositionsRef.current.get(node.address);
      const newNode: GraphNode & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number } = {
        id: node.address,
        name: node.pubkey ? `${node.pubkey.slice(0, 8)}...` : node.address.split(":")[0],
        pubkey: node.pubkey,
        version: node.version?.version || "unknown",
        status: node.status,
        peerCount,
        cpu: node.stats?.cpu_percent,
        uptime: node.stats?.uptime,
        syncIndex: node.stats?.current_index,
        val: Math.max(10, Math.min(30, peerCount * 2 + 10)), // Size based on peers
        color: isOnline
          ? (node.version?.version === "0.6.0" ? "#22c55e" : "#eab308")
          : "#ef4444",
      };

      // If node existed before, restore its position
      if (existingPos) {
        newNode.x = existingPos.x;
        newNode.y = existingPos.y;
        newNode.z = existingPos.z;
      }

      graphNodes.push(newNode);
    });

    // Map IP to full address for linking (only loaded nodes)
    const ipToAddress = new Map<string, string>();
    loadedNodes.forEach(node => {
      const ip = node.address.split(":")[0];
      ipToAddress.set(ip, node.address);
    });

    // Create links based on pods (known peers) - only between loaded nodes
    loadedNodes.forEach((node) => {
      if (node.pods?.pods) {
        node.pods.pods.forEach((pod) => {
          // Try to find matching node by IP (pods use port 9001, nodes use different ports)
          const podIp = pod.address.split(":")[0];
          const targetAddress = ipToAddress.get(podIp);

          if (targetAddress && targetAddress !== node.address) {
            const linkId = [node.address, targetAddress].sort().join("-");

            if (!linkSet.has(linkId)) {
              linkSet.add(linkId);

              // Check if bidirectional (target also knows source)
              const targetNode = loadedNodes.find(n => n.address === targetAddress);
              const sourceIp = node.address.split(":")[0];
              const isBidirectional = targetNode?.pods?.pods.some(
                p => p.address.split(":")[0] === sourceIp
              ) || false;

              // Check if connection is active (last seen < 5 minutes)
              const isActive = Date.now() / 1000 - pod.last_seen_timestamp < 300;

              graphLinks.push({
                source: node.address,
                target: targetAddress,
                bidirectional: isBidirectional,
                isActive,
                color: isBidirectional
                  ? (isActive ? "#00ffcc" : "#66aaff")
                  : (isActive ? "#ffcc00" : "#555555"),
              });
            }
          }
        });
      }
    });

    return { nodes: graphNodes, links: graphLinks };
  }, []);

  // Save current node positions before updating
  const saveNodePositions = useCallback(() => {
    if (fgRef.current && typeof fgRef.current.graphData === 'function') {
      try {
        const data = fgRef.current.graphData();
        if (data && data.nodes) {
          data.nodes.forEach((node: any) => {
            if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
              nodePositionsRef.current.set(node.id, { x: node.x, y: node.y, z: node.z });
            }
          });
        }
      } catch (e) {
        // Ignore errors during initial load
      }
    }
  }, []);

  // Throttled update - prevent too frequent rerenders
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Update graph when nodes change - preserve existing positions (throttled)
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Throttle updates to max once per 300ms
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    const doUpdate = () => {
      // Save positions of existing nodes before rebuilding
      saveNodePositions();

      const data = buildGraphData(nodes);
      setGraphData(data);
      lastUpdateRef.current = Date.now();

      // After updating, reheat simulation gently for new nodes only
      if (fgRef.current && data.nodes.length > 0) {
        setTimeout(() => {
          if (fgRef.current && typeof fgRef.current.d3ReheatSimulation === 'function') {
            try {
              fgRef.current.d3ReheatSimulation();
            } catch (e) {
              // Ignore errors
            }
          }
        }, 100);
      }
    };

    if (timeSinceLastUpdate > 300) {
      // Update immediately if enough time has passed
      doUpdate();
    } else {
      // Otherwise, schedule update
      updateTimeoutRef.current = setTimeout(doUpdate, 300 - timeSinceLastUpdate);
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [nodes, buildGraphData, saveNodePositions]);

  // Auto-rotate camera
  useEffect(() => {
    if (fgRef.current && autoRotate) {
      const distance = 400;
      let angle = 0;

      const interval = setInterval(() => {
        angle += 0.002;
        fgRef.current.cameraPosition({
          x: distance * Math.sin(angle),
          y: 100,
          z: distance * Math.cos(angle),
        });
      }, 30);

      return () => clearInterval(interval);
    }
  }, [autoRotate]);

  // Handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (onNodeClick) {
      const originalNode = nodes.find(n => n.address === node.id);
      if (originalNode) {
        onNodeClick(originalNode);
      }
    }

    // Focus on clicked node
    if (fgRef.current) {
      setAutoRotate(false);
      const distance = 150;
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      fgRef.current.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        node,
        2000
      );
    }
  }, [nodes, onNodeClick]);

  // Stats
  const stats = useMemo(() => {
    const loadedCount = nodes.filter(n => n.status !== "loading").length;
    const totalCount = nodes.length;
    const onlineCount = graphData.nodes.filter(n => n.status === "online").length;
    const bidirectionalLinks = graphData.links.filter(l => l.bidirectional).length;
    const activeLinks = graphData.links.filter(l => l.isActive).length;
    const isLoading = loadedCount < totalCount;
    return { onlineCount, bidirectionalLinks, activeLinks, totalLinks: graphData.links.length, loadedCount, totalCount, isLoading };
  }, [graphData, nodes]);

  return (
    <div ref={containerRef} className="relative w-full h-[600px] bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            autoRotate
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {autoRotate ? "Stop Rotation" : "Auto Rotate"}
        </button>
        <button
          onClick={() => {
            if (fgRef.current) {
              fgRef.current.zoomToFit(400);
            }
          }}
          className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
        >
          Reset View
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-zinc-900/95 backdrop-blur rounded-lg p-3 text-xs border border-zinc-700/50">
        <div className="font-medium text-zinc-300 mb-2">Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
            <span className="text-zinc-400">Online (v0.6.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: "#ffaa00", boxShadow: "0 0 8px #ffaa00" }} />
            <span className="text-zinc-400">Online (v0.5.x)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: "#ff3366", boxShadow: "0 0 8px #ff3366" }} />
            <span className="text-zinc-400">Offline</span>
          </div>
          <div className="border-t border-zinc-700 my-2" />
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 rounded" style={{ backgroundColor: "#00ffcc", boxShadow: "0 0 4px #00ffcc" }} />
            <span className="text-zinc-400">Bidirectional (Active)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 rounded" style={{ backgroundColor: "#66aaff", boxShadow: "0 0 4px #66aaff" }} />
            <span className="text-zinc-400">Bidirectional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 rounded" style={{ backgroundColor: "#ffcc00", boxShadow: "0 0 4px #ffcc00" }} />
            <span className="text-zinc-400">Unidirectional (Active)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 rounded bg-zinc-500" />
            <span className="text-zinc-400">Unidirectional</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 z-10 bg-zinc-800/90 rounded-lg p-3 text-xs">
        {stats.isLoading && (
          <div className="mb-2 pb-2 border-b border-zinc-700">
            <div className="flex items-center gap-2 text-yellow-400">
              <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading {stats.loadedCount}/{stats.totalCount}...</span>
            </div>
            <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${(stats.loadedCount / stats.totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-zinc-400">Nodes:</div>
          <div className="text-white font-medium">{stats.onlineCount}/{graphData.nodes.length}</div>
          <div className="text-zinc-400">Connections:</div>
          <div className="text-white font-medium">{stats.totalLinks}</div>
          <div className="text-zinc-400">Bidirectional:</div>
          <div className="text-green-400 font-medium">{stats.bidirectionalLinks}</div>
          <div className="text-zinc-400">Active:</div>
          <div className="text-cyan-400 font-medium">{stats.activeLinks}</div>
        </div>
      </div>

      {/* Hovered Node Info */}
      {hoveredNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-zinc-800/95 rounded-lg p-3 text-xs min-w-[200px]">
          <div className="font-medium text-white mb-2">{hoveredNode.name}</div>
          <div className="space-y-1 text-zinc-400">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={hoveredNode.status === "online" ? "text-green-400" : "text-red-400"}>
                {hoveredNode.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span className="text-zinc-300">{hoveredNode.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Peers:</span>
              <span className="text-zinc-300">{hoveredNode.peerCount}</span>
            </div>
            {hoveredNode.cpu !== undefined && (
              <div className="flex justify-between">
                <span>CPU:</span>
                <span className="text-zinc-300">{hoveredNode.cpu.toFixed(2)}%</span>
              </div>
            )}
            {hoveredNode.syncIndex !== undefined && (
              <div className="flex justify-between">
                <span>Sync Index:</span>
                <span className="text-cyan-400">#{hoveredNode.syncIndex}</span>
              </div>
            )}
          </div>
          {hoveredNode.pubkey && (
            <div className="mt-2 pt-2 border-t border-zinc-700">
              <div className="text-zinc-500 truncate" title={hoveredNode.pubkey}>
                {hoveredNode.pubkey}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls Help */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-zinc-800/80 rounded-lg px-3 py-1.5 text-xs text-zinc-400">
        <span className="text-zinc-300">Left-click + drag:</span> Rotate |
        <span className="text-zinc-300 ml-2">Right-click + drag:</span> Pan |
        <span className="text-zinc-300 ml-2">Scroll:</span> Zoom
      </div>

      {/* 3D Graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel=""
        nodeVal="val"
        // Custom 3D node with glow effect (optimized)
        nodeThreeObject={(node: any) => {
          const isOnline = node.status === "online";
          const isLatestVersion = node.version === "0.6.0";

          const colorSet = isOnline
            ? (isLatestVersion ? GLOW_COLORS.online_latest : GLOW_COLORS.online_older)
            : GLOW_COLORS.offline;

          const size = node.val || 10;

          // Create group for node
          const group = new THREE.Group();

          // Inner core sphere (bright) - use cached geometry
          const core = new THREE.Mesh(
            getCachedGeometry(size * 0.5, 12),
            getCachedMaterial(colorSet.emissive, 1)
          );
          group.add(core);

          // Outer glow sphere (transparent) - use cached
          const glow = new THREE.Mesh(
            getCachedGeometry(size * 0.7, 8),
            getCachedMaterial(colorSet.emissive, 0.25)
          );
          group.add(glow);

          return group;
        }}
        nodeOpacity={1}
        // Link settings (simplified)
        linkColor={(link: any) => link.color}
        linkOpacity={0.7}
        linkWidth={(link: any) => link.bidirectional ? 1.5 : 0.8}
        // Arrows on links
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link: any) => link.color}
        // Animated particles - reduced for performance
        linkDirectionalParticles={(link: any) => link.isActive ? 3 : 1}
        linkDirectionalParticleSpeed={0.008}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(link: any) => {
          if (link.bidirectional) {
            return link.isActive ? "#00ffcc" : "#66aaff";
          }
          return link.isActive ? "#ffcc00" : "#666666";
        }}
        linkDirectionalParticleResolution={6}
        // Curved links for better visibility
        linkCurvature={0.15}
        backgroundColor="#050508"
        onNodeClick={(node: any) => handleNodeClick(node as GraphNode)}
        onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
        enableNodeDrag={true}
        enableNavigationControls={true}
        controlType="orbit"
        showNavInfo={false}
        // Simulation settings - optimized for performance
        cooldownTicks={30}
        warmupTicks={0}
        d3AlphaDecay={0.08}
        d3VelocityDecay={0.4}
        // Reduce render frequency
        rendererConfig={{ antialias: false, alpha: true }}
        // Callback when node is dragged - save position
        onNodeDragEnd={(node: any) => {
          if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
            nodePositionsRef.current.set(node.id, { x: node.x, y: node.y, z: node.z });
          }
        }}
      />
    </div>
  );
}
