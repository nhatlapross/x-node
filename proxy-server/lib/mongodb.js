const { MongoClient, ServerApiVersion } = require('mongodb');

// MongoDB connection URI from environment
const uri = process.env.MONGODB_URI;

let client = null;
let db = null;

// Collection names
const COLLECTIONS = {
  NETWORK_SNAPSHOTS: 'network_snapshots',    // Aggregated network stats per interval
  NODE_HISTORY: 'node_history',              // Individual node stats over time
  PODS_SNAPSHOTS: 'pods_snapshots',          // Pods list snapshots
};

/**
 * Connect to MongoDB
 */
async function connect() {
  if (db) return db;

  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI not set, database features disabled');
    return null;
  }

  try {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    await client.connect();
    db = client.db('xandeum_pnodes');

    // Create indexes for efficient queries
    await createIndexes();

    console.log('[MongoDB] Connected successfully');
    return db;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
    return null;
  }
}

/**
 * Create indexes for collections
 */
async function createIndexes() {
  if (!db) return;

  try {
    // Network snapshots: query by network and time range
    await db.collection(COLLECTIONS.NETWORK_SNAPSHOTS).createIndex(
      { network: 1, timestamp: -1 },
      { background: true }
    );

    // Node history: query by address and time range
    await db.collection(COLLECTIONS.NODE_HISTORY).createIndex(
      { address: 1, timestamp: -1 },
      { background: true }
    );

    // Pods snapshots: query by network and time
    await db.collection(COLLECTIONS.PODS_SNAPSHOTS).createIndex(
      { network: 1, timestamp: -1 },
      { background: true }
    );

    // TTL index: auto-delete old data after 30 days
    await db.collection(COLLECTIONS.NETWORK_SNAPSHOTS).createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, background: true }
    );

    await db.collection(COLLECTIONS.NODE_HISTORY).createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, background: true }
    );

    console.log('[MongoDB] Indexes created');
  } catch (error) {
    console.error('[MongoDB] Index creation error:', error.message);
  }
}

/**
 * Get database instance
 */
function getDb() {
  return db;
}

/**
 * Close connection
 */
async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed');
  }
}

/**
 * Save network snapshot (aggregated stats)
 */
async function saveNetworkSnapshot(network, data) {
  if (!db) return null;

  const snapshot = {
    network,
    timestamp: new Date(),
    totalPods: data.totalPods || 0,
    onlineNodes: data.onlineNodes || 0,
    offlineNodes: data.offlineNodes || 0,
    totalStorage: data.totalStorage || 0,
    avgCpu: data.avgCpu || 0,
    avgRam: data.avgRam || 0,
    totalStreams: data.totalStreams || 0,
    totalBytesTransferred: data.totalBytesTransferred || 0,
    versionDistribution: data.versionDistribution || {},
  };

  try {
    const result = await db.collection(COLLECTIONS.NETWORK_SNAPSHOTS).insertOne(snapshot);
    return result.insertedId;
  } catch (error) {
    console.error('[MongoDB] Save network snapshot error:', error.message);
    return null;
  }
}

/**
 * Save node history (individual node stats)
 */
async function saveNodeHistory(nodes) {
  if (!db || !nodes || nodes.length === 0) return null;

  const timestamp = new Date();
  const documents = nodes.map(node => ({
    address: node.address,
    pubkey: node.pubkey,
    network: node.network,
    timestamp,
    status: node.status,
    version: node.version,
    cpu: node.cpu,
    ram: node.ram,
    storage: node.storage,
    uptime: node.uptime,
    activeStreams: node.activeStreams,
    packetsReceived: node.packetsReceived,
    packetsSent: node.packetsSent,
    peersCount: node.peersCount,
  }));

  try {
    const result = await db.collection(COLLECTIONS.NODE_HISTORY).insertMany(documents);
    return result.insertedCount;
  } catch (error) {
    console.error('[MongoDB] Save node history error:', error.message);
    return null;
  }
}

/**
 * Get network history for charts
 * @param {string} network - Network ID (devnet1, devnet2, etc.)
 * @param {string} period - Time period: '1h', '6h', '24h', '7d', '30d'
 * @param {string} interval - Data interval: '1m', '5m', '15m', '1h', '6h'
 */
async function getNetworkHistory(network, period = '24h', interval = '15m') {
  if (!db) return [];

  const now = new Date();
  const periodMs = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const intervalMs = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
  };

  const startTime = new Date(now.getTime() - (periodMs[period] || periodMs['24h']));
  const bucketMs = intervalMs[interval] || intervalMs['15m'];

  try {
    const pipeline = [
      {
        $match: {
          network,
          timestamp: { $gte: startTime },
        },
      },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: '$timestamp' },
                { $mod: [{ $toLong: '$timestamp' }, bucketMs] },
              ],
            },
          },
          totalPods: { $avg: '$totalPods' },
          onlineNodes: { $avg: '$onlineNodes' },
          offlineNodes: { $avg: '$offlineNodes' },
          totalStorage: { $avg: '$totalStorage' },
          avgCpu: { $avg: '$avgCpu' },
          avgRam: { $avg: '$avgRam' },
          totalStreams: { $avg: '$totalStreams' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          timestamp: '$_id',
          totalPods: { $round: ['$totalPods', 0] },
          onlineNodes: { $round: ['$onlineNodes', 0] },
          offlineNodes: { $round: ['$offlineNodes', 0] },
          totalStorage: { $round: ['$totalStorage', 0] },
          avgCpu: { $round: ['$avgCpu', 2] },
          avgRam: { $round: ['$avgRam', 2] },
          totalStreams: { $round: ['$totalStreams', 0] },
        },
      },
    ];

    const results = await db.collection(COLLECTIONS.NETWORK_SNAPSHOTS).aggregate(pipeline).toArray();
    return results;
  } catch (error) {
    console.error('[MongoDB] Get network history error:', error.message);
    return [];
  }
}

/**
 * Get node history for charts
 * @param {string} address - Node address (ip:port)
 * @param {string} period - Time period
 */
async function getNodeHistory(address, period = '24h') {
  if (!db) return [];

  const now = new Date();
  const periodMs = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };

  const startTime = new Date(now.getTime() - (periodMs[period] || periodMs['24h']));

  try {
    const results = await db.collection(COLLECTIONS.NODE_HISTORY)
      .find({
        address,
        timestamp: { $gte: startTime },
      })
      .sort({ timestamp: 1 })
      .project({
        _id: 0,
        timestamp: 1,
        status: 1,
        cpu: 1,
        ram: 1,
        storage: 1,
        uptime: 1,
        activeStreams: 1,
        peersCount: 1,
      })
      .toArray();

    return results;
  } catch (error) {
    console.error('[MongoDB] Get node history error:', error.message);
    return [];
  }
}

/**
 * Get aggregated stats across all networks
 */
async function getAggregatedStats(period = '24h') {
  if (!db) return null;

  const now = new Date();
  const periodMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };

  const startTime = new Date(now.getTime() - (periodMs[period] || periodMs['24h']));

  try {
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startTime },
        },
      },
      {
        $group: {
          _id: null,
          avgTotalPods: { $avg: '$totalPods' },
          avgOnlineNodes: { $avg: '$onlineNodes' },
          maxOnlineNodes: { $max: '$onlineNodes' },
          minOnlineNodes: { $min: '$onlineNodes' },
          avgCpu: { $avg: '$avgCpu' },
          avgRam: { $avg: '$avgRam' },
          totalSnapshots: { $sum: 1 },
        },
      },
    ];

    const results = await db.collection(COLLECTIONS.NETWORK_SNAPSHOTS).aggregate(pipeline).toArray();
    return results[0] || null;
  } catch (error) {
    console.error('[MongoDB] Get aggregated stats error:', error.message);
    return null;
  }
}

/**
 * Get latest snapshot for each network
 */
async function getLatestSnapshots() {
  if (!db) return [];

  try {
    const pipeline = [
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$network',
          latestSnapshot: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$latestSnapshot' },
      },
    ];

    const results = await db.collection(COLLECTIONS.NETWORK_SNAPSHOTS).aggregate(pipeline).toArray();
    return results;
  } catch (error) {
    console.error('[MongoDB] Get latest snapshots error:', error.message);
    return [];
  }
}

module.exports = {
  connect,
  close,
  getDb,
  COLLECTIONS,
  saveNetworkSnapshot,
  saveNodeHistory,
  getNetworkHistory,
  getNodeHistory,
  getAggregatedStats,
  getLatestSnapshots,
};
