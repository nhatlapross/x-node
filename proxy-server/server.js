require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// MongoDB and data collector
const mongodb = require('./lib/mongodb');
const { startCollector, getLatestData } = require('./lib/dataCollector');
const telegramBot = require('./lib/telegramBot');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - allow all origins (or specify your frontend domain)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// RPC endpoints configuration
const RPC_ENDPOINTS = {
  devnet1: 'https://rpc1.pchednode.com/rpc',
  devnet2: 'https://rpc2.pchednode.com/rpc',
  mainnet1: 'https://rpc3.pchednode.com/rpc',
  mainnet2: 'https://rpc4.pchednode.com/rpc',
};

// Cache for RPC responses (simple in-memory cache)
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
  });
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Xandeum RPC Proxy',
    endpoints: Object.keys(RPC_ENDPOINTS),
    features: ['rpc-proxy', 'historical-data', 'charts'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', mongodb: mongodb.getDb() ? 'connected' : 'disconnected' });
});

// Get pods from a network
app.get('/api/pods/:network', async (req, res) => {
  const { network } = req.params;
  const rpcUrl = RPC_ENDPOINTS[network];

  if (!rpcUrl) {
    return res.status(400).json({ error: `Invalid network: ${network}` });
  }

  // Check cache
  const cacheKey = `pods_${network}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'XandeumProxy/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'get-pods',
        id: 1,
      }),
      timeout: 30000,
    });

    const data = await response.json();

    if (data.result) {
      setCache(cacheKey, data.result);
      res.json(data.result);
    } else {
      res.status(500).json({ error: data.error || 'RPC error' });
    }
  } catch (error) {
    console.error(`[${network}] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all networks pods
app.get('/api/pods', async (req, res) => {
  const results = {};

  for (const [network, rpcUrl] of Object.entries(RPC_ENDPOINTS)) {
    const cacheKey = `pods_${network}`;
    const cached = getCached(cacheKey);

    if (cached) {
      results[network] = { ...cached, cached: true };
      continue;
    }

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'XandeumProxy/1.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'get-pods',
          id: 1,
        }),
        timeout: 30000,
      });

      const data = await response.json();

      if (data.result) {
        setCache(cacheKey, data.result);
        results[network] = data.result;
      } else {
        results[network] = { error: data.error || 'RPC error' };
      }
    } catch (error) {
      console.error(`[${network}] Error:`, error.message);
      results[network] = { error: error.message };
    }
  }

  res.json(results);
});

// Proxy any RPC call
app.post('/api/rpc', async (req, res) => {
  const { endpoint, method, params } = req.body;

  if (!endpoint || !method) {
    return res.status(400).json({ error: 'Missing endpoint or method' });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'XandeumProxy/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params: params || {},
        id: 1,
      }),
      timeout: 10000,
    });

    const text = await response.text();

    // Check for Cloudflare challenge
    if (text.includes('Just a moment') || text.includes('cf_chl_opt')) {
      return res.status(503).json({ error: 'Cloudflare challenge - please try again' });
    }

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Invalid JSON response' });
    }
  } catch (error) {
    console.error('[RPC Proxy] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get node data (version, stats, pods)
app.get('/api/node/:ip', async (req, res) => {
  const { ip } = req.params;
  const port = req.query.port || '6000';
  const endpoint = `http://${ip}:${port}/rpc`;

  const results = {};

  // Fetch version
  try {
    const versionRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'get-version', id: 1 }),
      timeout: 5000,
    });
    const versionData = await versionRes.json();
    results.version = versionData.result;
  } catch (error) {
    results.version = null;
    results.versionError = error.message;
  }

  // Fetch stats
  try {
    const statsRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'get-stats', id: 1 }),
      timeout: 5000,
    });
    const statsData = await statsRes.json();
    results.stats = statsData.result;
  } catch (error) {
    results.stats = null;
    results.statsError = error.message;
  }

  // Fetch pods/peers
  try {
    const podsRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'get-pods', id: 1 }),
      timeout: 5000,
    });
    const podsData = await podsRes.json();
    results.pods = podsData.result;
  } catch (error) {
    results.pods = null;
    results.podsError = error.message;
  }

  results.status = results.version ? 'online' : 'offline';
  res.json(results);
});

// Batch get multiple nodes
app.post('/api/nodes/batch', async (req, res) => {
  const { addresses } = req.body;

  if (!addresses || !Array.isArray(addresses)) {
    return res.status(400).json({ error: 'Missing addresses array' });
  }

  const results = await Promise.all(
    addresses.slice(0, 20).map(async (address) => { // Limit to 20 nodes per batch
      const [ip, port = '6000'] = address.split(':');
      const endpoint = `http://${ip}:${port}/rpc`;

      try {
        const [versionRes, statsRes] = await Promise.all([
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
        ]);

        return {
          address,
          status: versionRes?.result ? 'online' : 'offline',
          version: versionRes?.result || null,
          stats: statsRes?.result || null,
        };
      } catch (error) {
        return {
          address,
          status: 'offline',
          error: error.message,
        };
      }
    })
  );

  res.json({ nodes: results });
});

// ============================================
// Historical Data APIs for Charts
// ============================================

/**
 * GET /api/history/network/:network
 * Get historical data for a specific network
 * Query params:
 *   - period: '1h', '6h', '24h', '7d', '30d' (default: '24h')
 *   - interval: '1m', '5m', '15m', '1h', '6h' (default: '15m')
 */
app.get('/api/history/network/:network', async (req, res) => {
  const { network } = req.params;
  const { period = '24h', interval = '15m' } = req.query;

  if (!RPC_ENDPOINTS[network]) {
    return res.status(400).json({ error: `Invalid network: ${network}` });
  }

  try {
    const data = await mongodb.getNetworkHistory(network, period, interval);
    res.json({
      success: true,
      network,
      period,
      interval,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[History] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/node/:address
 * Get historical data for a specific node
 * Query params:
 *   - period: '1h', '6h', '24h', '7d' (default: '24h')
 */
app.get('/api/history/node/:address', async (req, res) => {
  const { address } = req.params;
  const { period = '24h' } = req.query;

  try {
    const data = await mongodb.getNodeHistory(address, period);
    res.json({
      success: true,
      address,
      period,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[History] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/stats
 * Get aggregated stats across all networks
 * Query params:
 *   - period: '1h', '24h', '7d' (default: '24h')
 */
app.get('/api/history/stats', async (req, res) => {
  const { period = '24h' } = req.query;

  try {
    const stats = await mongodb.getAggregatedStats(period);
    const latestSnapshots = await mongodb.getLatestSnapshots();

    res.json({
      success: true,
      period,
      aggregated: stats,
      latest: latestSnapshots,
    });
  } catch (error) {
    console.error('[History] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/latest
 * Get latest cached data from collector (real-time)
 */
app.get('/api/history/latest', (req, res) => {
  const { network } = req.query;
  const data = getLatestData(network || undefined);

  res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/charts/network/:network
 * Pre-formatted data for frontend charts
 */
app.get('/api/charts/network/:network', async (req, res) => {
  const { network } = req.params;
  const { period = '24h' } = req.query;

  if (!RPC_ENDPOINTS[network]) {
    return res.status(400).json({ error: `Invalid network: ${network}` });
  }

  // Determine interval based on period
  const intervalMap = {
    '1h': '1m',
    '6h': '5m',
    '24h': '15m',
    '7d': '1h',
    '30d': '6h',
  };
  const interval = intervalMap[period] || '15m';

  try {
    const rawData = await mongodb.getNetworkHistory(network, period, interval);

    // Format for recharts
    const chartData = {
      nodes: rawData.map(d => ({
        time: new Date(d.timestamp).getTime(),
        online: d.onlineNodes,
        offline: d.offlineNodes,
        total: d.totalPods,
      })),
      resources: rawData.map(d => ({
        time: new Date(d.timestamp).getTime(),
        cpu: d.avgCpu,
        ram: d.avgRam,
      })),
      storage: rawData.map(d => ({
        time: new Date(d.timestamp).getTime(),
        storage: d.totalStorage,
        streams: d.totalStreams,
      })),
    };

    res.json({
      success: true,
      network,
      period,
      interval,
      charts: chartData,
    });
  } catch (error) {
    console.error('[Charts] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/charts/comparison
 * Compare multiple networks
 */
app.get('/api/charts/comparison', async (req, res) => {
  const { period = '24h' } = req.query;
  const networks = Object.keys(RPC_ENDPOINTS);

  // Determine interval based on period
  const intervalMap = {
    '1h': '5m',
    '6h': '15m',
    '24h': '1h',
    '7d': '6h',
  };
  const interval = intervalMap[period] || '1h';

  try {
    const comparison = {};

    for (const network of networks) {
      const rawData = await mongodb.getNetworkHistory(network, period, interval);
      comparison[network] = rawData.map(d => ({
        time: new Date(d.timestamp).getTime(),
        online: d.onlineNodes,
        total: d.totalPods,
        avgCpu: d.avgCpu,
      }));
    }

    res.json({
      success: true,
      period,
      interval,
      networks,
      data: comparison,
    });
  } catch (error) {
    console.error('[Charts] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Pod Credits API
// ============================================

// Pod Credits API URL
const POD_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';

// Cache for pod credits
let podCreditsCache = null;
let podCreditsExpiry = 0;
const POD_CREDITS_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * GET /api/pod-credits
 * Get pod credits from Xandeum network
 */
app.get('/api/pod-credits', async (req, res) => {
  // Check cache
  if (podCreditsCache && Date.now() < podCreditsExpiry) {
    return res.json(podCreditsCache);
  }

  try {
    const response = await fetch(POD_CREDITS_API, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'XandeumProxy/1.0',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      console.error('[PodCredits] Failed:', response.status);
      return res.status(response.status).json({
        error: `Failed to fetch pod credits: ${response.status}`,
      });
    }

    const data = await response.json();

    // Cache the result
    podCreditsCache = data;
    podCreditsExpiry = Date.now() + POD_CREDITS_CACHE_TTL;

    res.json(data);
  } catch (error) {
    console.error('[PodCredits] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to get pod credits (for internal use)
 */
async function fetchPodCredits() {
  // Return from cache if valid
  if (podCreditsCache && Date.now() < podCreditsExpiry) {
    return podCreditsCache;
  }

  try {
    const response = await fetch(POD_CREDITS_API, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'XandeumProxy/1.0',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Cache the result
    podCreditsCache = data;
    podCreditsExpiry = Date.now() + POD_CREDITS_CACHE_TTL;

    return data;
  } catch (error) {
    console.error('[PodCredits] Error:', error.message);
    return null;
  }
}

// ============================================
// AI Chat API for Frontend
// ============================================

/**
 * POST /api/ai/ask
 * Ask AI about network status
 * Body: { question: string }
 */
app.post('/api/ai/ask', async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid question' });
  }

  if (question.length > 500) {
    return res.status(400).json({ success: false, error: 'Question too long (max 500 characters)' });
  }

  try {
    const result = await telegramBot.askAI(question);

    if (result.success) {
      res.json({
        success: true,
        question,
        answer: result.response,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'AI processing failed',
      });
    }
  } catch (error) {
    console.error('[AI API] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/status
 * Check if AI is available
 */
app.get('/api/ai/status', (req, res) => {
  const isAIEnabled = !!process.env.GEMINI_API_KEY;
  res.json({
    success: true,
    aiEnabled: isAIEnabled,
    model: isAIEnabled ? 'gemini-2.0-flash' : null,
  });
});

// ============================================
// Server Startup
// ============================================

async function startServer() {
  // Connect to MongoDB
  await mongodb.connect();

  // Start data collector (every 5 minutes)
  const collectorSchedule = process.env.COLLECTOR_SCHEDULE || '*/5 * * * *';
  startCollector(collectorSchedule);

  // Initialize Telegram bot
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (botToken) {
    telegramBot.initBot(botToken, geminiApiKey);
    console.log('Telegram bot: enabled');
  } else {
    console.log('Telegram bot: disabled (no TELEGRAM_BOT_TOKEN)');
  }

  // Start Express server
  app.listen(PORT, () => {
    console.log(`Xandeum RPC Proxy running on port ${PORT}`);
    console.log(`Endpoints: ${Object.keys(RPC_ENDPOINTS).join(', ')}`);
    console.log(`MongoDB: ${mongodb.getDb() ? 'connected' : 'not configured'}`);
    console.log(`Data collector: ${collectorSchedule}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  telegramBot.stopBot();
  await mongodb.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  telegramBot.stopBot();
  await mongodb.close();
  process.exit(0);
});

// Start the server
startServer().catch(console.error);
