const cron = require('node-cron');
const fetch = require('node-fetch');
const { saveNetworkSnapshot, saveNodeHistory } = require('./mongodb');

// RPC endpoints configuration
const RPC_ENDPOINTS = {
  devnet1: 'https://rpc1.pchednode.com/rpc',
  devnet2: 'https://rpc2.pchednode.com/rpc',
  mainnet1: 'https://rpc3.pchednode.com/rpc',
  mainnet2: 'https://rpc4.pchednode.com/rpc',
};

// In-memory cache for quick access
let latestData = {
  devnet1: null,
  devnet2: null,
  mainnet1: null,
  mainnet2: null,
};

/**
 * Fetch pods from RPC endpoint
 */
async function fetchPods(network) {
  const rpcUrl = RPC_ENDPOINTS[network];
  if (!rpcUrl) return null;

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'XandeumCollector/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-pods',
        id: 1,
      }),
      timeout: 30000,
    });

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error(`[Collector] Failed to fetch pods from ${network}:`, error.message);
    return null;
  }
}

/**
 * Fetch node stats from individual node
 */
async function fetchNodeStats(address) {
  const [ip, port = '6000'] = address.split(':');
  const endpoint = `http://${ip}:${port}/rpc`;

  try {
    const [versionRes, statsRes, podsRes] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'get-version', id: 1 }),
        timeout: 5000,
      }).then(r => r.json()).catch(() => null),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'get-stats', id: 1 }),
        timeout: 5000,
      }).then(r => r.json()).catch(() => null),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'get-pods', id: 1 }),
        timeout: 5000,
      }).then(r => r.json()).catch(() => null),
    ]);

    const isOnline = versionRes?.result || statsRes?.result;

    return {
      status: isOnline ? 'online' : 'offline',
      version: versionRes?.result?.version || null,
      cpu: statsRes?.result?.cpu_percent || null,
      ram: statsRes?.result ? (statsRes.result.ram_used / statsRes.result.ram_total) * 100 : null,
      storage: statsRes?.result?.file_size || null,
      uptime: statsRes?.result?.uptime || null,
      activeStreams: statsRes?.result?.active_streams || null,
      packetsReceived: statsRes?.result?.packets_received || null,
      packetsSent: statsRes?.result?.packets_sent || null,
      peersCount: podsRes?.result?.total_count || null,
    };
  } catch (error) {
    return { status: 'offline' };
  }
}

/**
 * Collect data for a single network
 */
async function collectNetworkData(network) {
  console.log(`[Collector] Collecting data for ${network}...`);

  const podsData = await fetchPods(network);
  if (!podsData || !podsData.pods) {
    console.log(`[Collector] No pods data for ${network}`);
    return null;
  }

  const pods = podsData.pods;
  const totalPods = podsData.total_count || pods.length;

  // Sample nodes for detailed stats (limit to 20 for performance)
  const sampleSize = Math.min(20, pods.length);
  const sampledPods = pods.slice(0, sampleSize);

  // Fetch stats for sampled nodes in parallel (batch of 5)
  const nodeStats = [];
  for (let i = 0; i < sampledPods.length; i += 5) {
    const batch = sampledPods.slice(i, i + 5);
    const batchStats = await Promise.all(
      batch.map(async (pod) => {
        const stats = await fetchNodeStats(pod.address);
        return {
          address: pod.address,
          pubkey: pod.pubkey,
          network,
          ...stats,
        };
      })
    );
    nodeStats.push(...batchStats);
  }

  // Calculate aggregated stats
  const onlineNodes = nodeStats.filter(n => n.status === 'online');
  const offlineNodes = nodeStats.filter(n => n.status === 'offline');

  const aggregatedData = {
    totalPods,
    onlineNodes: onlineNodes.length,
    offlineNodes: offlineNodes.length,
    totalStorage: onlineNodes.reduce((acc, n) => acc + (n.storage || 0), 0),
    avgCpu: onlineNodes.length > 0
      ? onlineNodes.reduce((acc, n) => acc + (n.cpu || 0), 0) / onlineNodes.length
      : 0,
    avgRam: onlineNodes.length > 0
      ? onlineNodes.reduce((acc, n) => acc + (n.ram || 0), 0) / onlineNodes.length
      : 0,
    totalStreams: onlineNodes.reduce((acc, n) => acc + (n.activeStreams || 0), 0),
    totalBytesTransferred: onlineNodes.reduce((acc, n) => acc + (n.packetsReceived || 0) + (n.packetsSent || 0), 0),
    versionDistribution: nodeStats.reduce((acc, n) => {
      if (n.version) {
        acc[n.version] = (acc[n.version] || 0) + 1;
      }
      return acc;
    }, {}),
  };

  // Update in-memory cache
  latestData[network] = {
    timestamp: new Date(),
    pods: podsData,
    stats: aggregatedData,
    nodeStats,
  };

  // Save to MongoDB
  await saveNetworkSnapshot(network, aggregatedData);
  await saveNodeHistory(nodeStats);

  console.log(`[Collector] ${network}: ${totalPods} pods, ${onlineNodes.length} online, ${offlineNodes.length} offline`);

  return aggregatedData;
}

/**
 * Collect data for all networks
 */
async function collectAllNetworks() {
  console.log('[Collector] Starting data collection cycle...');
  const startTime = Date.now();

  const results = {};
  for (const network of Object.keys(RPC_ENDPOINTS)) {
    try {
      results[network] = await collectNetworkData(network);
    } catch (error) {
      console.error(`[Collector] Error collecting ${network}:`, error.message);
      results[network] = null;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Collector] Collection cycle completed in ${duration}s`);

  return results;
}

/**
 * Get latest cached data
 */
function getLatestData(network) {
  if (network) {
    return latestData[network];
  }
  return latestData;
}

/**
 * Start the data collector cron job
 * @param {string} schedule - Cron schedule (default: every 5 minutes)
 */
function startCollector(schedule = '*/5 * * * *') {
  console.log(`[Collector] Starting with schedule: ${schedule}`);

  // Run immediately on startup
  setTimeout(() => {
    collectAllNetworks().catch(console.error);
  }, 5000);

  // Schedule periodic collection
  const job = cron.schedule(schedule, () => {
    collectAllNetworks().catch(console.error);
  });

  return job;
}

/**
 * Stop the collector
 */
function stopCollector(job) {
  if (job) {
    job.stop();
    console.log('[Collector] Stopped');
  }
}

module.exports = {
  startCollector,
  stopCollector,
  collectAllNetworks,
  collectNetworkData,
  getLatestData,
  fetchPods,
  fetchNodeStats,
};
