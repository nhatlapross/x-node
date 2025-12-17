// Proxy server configuration
// Update PROXY_URL after deploying the proxy server

// For local development:
// export const PROXY_URL = 'http://localhost:3001';

// For production (update with your deployed proxy URL):
export const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || '';

// Whether to use the proxy server
export const USE_PROXY = !!PROXY_URL;

// Valid periods and intervals for historical data
export type HistoryPeriod = '1h' | '6h' | '24h' | '7d' | '30d';
export type HistoryInterval = '1m' | '5m' | '15m' | '1h' | '6h';

// API endpoints
export const proxyEndpoints = {
  // Get pods from a specific network
  getPods: (network: string) => `${PROXY_URL}/api/pods/${network}`,

  // Get pods from all networks
  getAllPods: () => `${PROXY_URL}/api/pods`,

  // Generic RPC proxy
  rpc: () => `${PROXY_URL}/api/rpc`,

  // Get single node data
  getNode: (ip: string, port = '6000') => `${PROXY_URL}/api/node/${ip}?port=${port}`,

  // Batch get multiple nodes
  batchNodes: () => `${PROXY_URL}/api/nodes/batch`,

  // ============================================
  // Historical Data Endpoints
  // ============================================

  // Get historical data for a specific network
  // period: '1h', '6h', '24h', '7d', '30d' (default: '24h')
  // interval: '1m', '5m', '15m', '1h', '6h' (default: '15m')
  networkHistory: (network: string, period: HistoryPeriod = '24h', interval?: HistoryInterval) => {
    const params = new URLSearchParams({ period });
    if (interval) params.set('interval', interval);
    return `${PROXY_URL}/api/history/network/${network}?${params}`;
  },

  // Get historical data for a specific node
  nodeHistory: (address: string, period: HistoryPeriod = '24h') =>
    `${PROXY_URL}/api/history/node/${encodeURIComponent(address)}?period=${period}`,

  // Get aggregated stats across all networks
  historyStats: (period: HistoryPeriod = '24h') =>
    `${PROXY_URL}/api/history/stats?period=${period}`,

  // Get latest cached data from collector (real-time)
  historyLatest: (network?: string) =>
    `${PROXY_URL}/api/history/latest${network ? `?network=${network}` : ''}`,

  // ============================================
  // Chart Data Endpoints (pre-formatted for Recharts)
  // ============================================

  // Get chart-ready data for a specific network
  networkCharts: (network: string, period: HistoryPeriod = '24h') =>
    `${PROXY_URL}/api/charts/network/${network}?period=${period}`,

  // Compare multiple networks
  chartsComparison: (period: HistoryPeriod = '24h') =>
    `${PROXY_URL}/api/charts/comparison?period=${period}`,
};
