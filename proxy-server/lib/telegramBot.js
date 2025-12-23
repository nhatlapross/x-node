const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
const { getLatestSnapshots, getNodeHistory, getHistoricalData } = require('./mongodb');
const { getLatestData, fetchPods } = require('./dataCollector');

// Bot instance
let bot = null;

// Gemini AI instance
let genAI = null;
let aiModel = null;

// Pod Credits API
const POD_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';
let podCreditsCache = null;
let podCreditsExpiry = 0;
const POD_CREDITS_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Fetch pod credits from API
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

/**
 * Get credits map from pod credits data
 */
function getCreditsMap(podCreditsData) {
  const creditsMap = new Map();
  if (podCreditsData && podCreditsData.pods_credits) {
    podCreditsData.pods_credits.forEach(pc => {
      creditsMap.set(pc.pod_id, pc.credits);
    });
  }
  return creditsMap;
}

/**
 * Initialize Gemini AI
 */
function initAI(apiKey) {
  if (!apiKey) {
    console.log('[AI] No Gemini API key provided, AI features disabled');
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    aiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('[AI] Gemini 2.0 Flash initialized successfully');
    return true;
  } catch (error) {
    console.error('[AI] Failed to initialize Gemini:', error.message);
    return false;
  }
}

/**
 * Get current network data as context for AI
 */
async function getNetworkContext() {
  try {
    const snapshots = await getLatestSnapshots();
    if (!snapshots || snapshots.length === 0) {
      return 'No network data available.';
    }

    let context = 'Current Xandeum pNodes Network Status:\n\n';

    let totalNodes = 0;
    let totalOnline = 0;
    let totalStorage = 0;
    let allOnlineNodes = [];
    let allOfflineNodes = [];

    for (const data of snapshots) {
      const online = data.estimatedOnline || data.onlineNodes || 0;
      const offline = data.estimatedOffline || data.offlineNodes || 0;
      const total = data.totalPods || 0;

      totalNodes += total;
      totalOnline += online;
      totalStorage += data.totalStorage || 0;

      context += `${data.network}:\n`;
      context += `  - Total nodes: ${total}\n`;
      context += `  - Online: ${online} (${data.onlineRatio || 0}%)\n`;
      context += `  - Offline: ${offline}\n`;
      context += `  - Avg CPU: ${data.avgCpu?.toFixed(1) || 'N/A'}%\n`;
      context += `  - Avg RAM: ${data.avgRam?.toFixed(1) || 'N/A'}%\n`;
      context += `  - Total Storage: ${formatBytesForAI(data.totalStorage)}\n`;
      context += `  - Total Streams: ${data.totalStreams || 0}\n`;
      context += `  - Avg Uptime: ${formatUptimeForAI(data.avgUptime)}\n`;

      if (data.versionDistribution) {
        const versions = Object.entries(data.versionDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        context += `  - Top versions: ${versions.map(([v, c]) => `${v}(${c})`).join(', ')}\n`;
      }

      // Get individual node stats from latest data
      const latestData = getLatestData(data.network);
      if (latestData && latestData.nodeStats) {
        const onlineNodes = latestData.nodeStats.filter(n => n.status === 'online');
        const offlineNodes = latestData.nodeStats.filter(n => n.status === 'offline');

        allOnlineNodes.push(...onlineNodes.map(n => ({ ...n, network: data.network })));
        allOfflineNodes.push(...offlineNodes.map(n => ({ ...n, network: data.network })));
      }

      context += '\n';
    }

    context += `Summary:\n`;
    context += `  - Total nodes across all networks: ${totalNodes}\n`;
    context += `  - Total online: ${totalOnline}\n`;
    context += `  - Total storage: ${formatBytesForAI(totalStorage)}\n`;
    context += `  - Overall online ratio: ${totalNodes > 0 ? Math.round((totalOnline / totalNodes) * 100) : 0}%\n\n`;

    // Add top nodes by uptime
    if (allOnlineNodes.length > 0) {
      const topByUptime = [...allOnlineNodes]
        .filter(n => n.uptime)
        .sort((a, b) => (b.uptime || 0) - (a.uptime || 0))
        .slice(0, 10);

      if (topByUptime.length > 0) {
        context += `Top 10 Nodes by Uptime:\n`;
        topByUptime.forEach((node, i) => {
          context += `  ${i + 1}. ${node.address} (${node.network}) - Uptime: ${formatUptimeForAI(node.uptime)}, CPU: ${node.cpu?.toFixed(1) || 'N/A'}%, RAM: ${node.ram?.toFixed(1) || 'N/A'}%, Version: ${node.version || 'N/A'}\n`;
        });
        context += '\n';
      }

      // Nodes with high CPU (>80%)
      const highCpuNodes = allOnlineNodes.filter(n => n.cpu && n.cpu > 80);
      if (highCpuNodes.length > 0) {
        context += `Nodes with High CPU (>80%):\n`;
        highCpuNodes.slice(0, 5).forEach(node => {
          context += `  - ${node.address} (${node.network}): CPU ${node.cpu?.toFixed(1)}%\n`;
        });
        context += '\n';
      }

      // Nodes with high RAM (>80%)
      const highRamNodes = allOnlineNodes.filter(n => n.ram && n.ram > 80);
      if (highRamNodes.length > 0) {
        context += `Nodes with High RAM (>80%):\n`;
        highRamNodes.slice(0, 5).forEach(node => {
          context += `  - ${node.address} (${node.network}): RAM ${node.ram?.toFixed(1)}%\n`;
        });
        context += '\n';
      }

      // Top nodes by storage
      const topByStorage = [...allOnlineNodes]
        .filter(n => n.storage)
        .sort((a, b) => (b.storage || 0) - (a.storage || 0))
        .slice(0, 5);

      if (topByStorage.length > 0) {
        context += `Top 5 Nodes by Storage:\n`;
        topByStorage.forEach((node, i) => {
          context += `  ${i + 1}. ${node.address} (${node.network}) - Storage: ${formatBytesForAI(node.storage)}\n`;
        });
        context += '\n';
      }
    }

    // Sample offline nodes
    if (allOfflineNodes.length > 0) {
      context += `Sample Offline Nodes (${allOfflineNodes.length} total):\n`;
      allOfflineNodes.slice(0, 10).forEach(node => {
        context += `  - ${node.address} (${node.network})\n`;
      });
      context += '\n';
    }

    return context;
  } catch (error) {
    console.error('[AI] Error getting network context:', error);
    return 'Error fetching network data.';
  }
}

function formatBytesForAI(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptimeForAI(seconds) {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days} days ${hours} hours`;
  return `${hours} hours`;
}

/**
 * Get all nodes data from all networks
 */
function getAllNodesData() {
  const networks = ['devnet1', 'devnet2', 'mainnet1', 'mainnet2'];
  const allNodes = [];

  for (const network of networks) {
    const latestData = getLatestData(network);
    if (latestData && latestData.nodeStats) {
      allNodes.push(...latestData.nodeStats.map(n => ({ ...n, network })));
    }
  }

  return allNodes;
}

/**
 * Find node by pubkey or address
 */
function findNodeByQuery(query) {
  const allNodes = getAllNodesData();
  const queryLower = query.toLowerCase();

  // Try exact match first
  let node = allNodes.find(n =>
    n.pubkey === query ||
    n.address === query
  );

  // Try partial match
  if (!node) {
    node = allNodes.find(n =>
      n.pubkey?.toLowerCase().includes(queryLower) ||
      n.address?.toLowerCase().includes(queryLower)
    );
  }

  return node;
}

/**
 * Get detailed node info as string (with credits)
 */
async function formatNodeInfo(node) {
  if (!node) return 'Node not found.';

  // Fetch credits for this node
  let credits = 0;
  if (node.pubkey) {
    const podCreditsData = await fetchPodCredits();
    const creditsMap = getCreditsMap(podCreditsData);
    credits = creditsMap.get(node.pubkey) || 0;
  }

  return `Node Details:
  - Address: ${node.address}
  - Pubkey: ${node.pubkey}
  - Network: ${node.network}
  - Status: ${node.status}
  - Version: ${node.version || 'N/A'}
  - Reputation Credits: ${credits.toLocaleString()}
  - CPU: ${node.cpu?.toFixed(1) || 'N/A'}%
  - RAM: ${node.ram?.toFixed(1) || 'N/A'}%
  - Storage: ${formatBytesForAI(node.storage)}
  - Uptime: ${formatUptimeForAI(node.uptime)}
  - Active Streams: ${node.activeStreams || 0}
  - Packets Received: ${node.packetsReceived || 0}
  - Packets Sent: ${node.packetsSent || 0}
  - Peers Count: ${node.peersCount || 'N/A'}`;
}

/**
 * Get rankings and statistics for AI context
 */
async function getNodeRankings() {
  const allNodes = getAllNodesData();
  const onlineNodes = allNodes.filter(n => n.status === 'online');

  if (onlineNodes.length === 0) {
    return 'No online nodes data available.';
  }

  // Fetch pod credits
  const podCreditsData = await fetchPodCredits();
  const creditsMap = getCreditsMap(podCreditsData);

  // Add credits to nodes
  const nodesWithCredits = allNodes.map(n => ({
    ...n,
    credits: n.pubkey ? (creditsMap.get(n.pubkey) || 0) : 0,
  }));

  const onlineNodesWithCredits = nodesWithCredits.filter(n => n.status === 'online');

  let rankings = '\n=== NODE RANKINGS ===\n\n';

  // Top 10 by Credits (Reputation)
  const byCredits = [...nodesWithCredits]
    .filter(n => n.credits > 0)
    .sort((a, b) => (b.credits || 0) - (a.credits || 0));

  rankings += 'TOP 10 BY REPUTATION CREDITS:\n';
  if (byCredits.length > 0) {
    byCredits.slice(0, 10).forEach((node, i) => {
      rankings += `${i + 1}. ${node.address} (${node.network}) - ${node.credits.toLocaleString()} credits | Status: ${node.status} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
    });
  } else {
    rankings += '  No credits data available.\n';
  }

  // Top 10 by Uptime
  const byUptime = [...onlineNodesWithCredits]
    .filter(n => n.uptime)
    .sort((a, b) => (b.uptime || 0) - (a.uptime || 0));

  rankings += '\nTOP 10 BY UPTIME:\n';
  byUptime.slice(0, 10).forEach((node, i) => {
    rankings += `${i + 1}. ${node.address} (${node.network}) - ${formatUptimeForAI(node.uptime)} | Credits: ${node.credits.toLocaleString()} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
  });

  // Top 10 by Storage
  const byStorage = [...onlineNodesWithCredits]
    .filter(n => n.storage)
    .sort((a, b) => (b.storage || 0) - (a.storage || 0));

  rankings += '\nTOP 10 BY STORAGE:\n';
  byStorage.slice(0, 10).forEach((node, i) => {
    rankings += `${i + 1}. ${node.address} (${node.network}) - ${formatBytesForAI(node.storage)} | Credits: ${node.credits.toLocaleString()} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
  });

  // Top 10 by Active Streams
  const byStreams = [...onlineNodesWithCredits]
    .filter(n => n.activeStreams)
    .sort((a, b) => (b.activeStreams || 0) - (a.activeStreams || 0));

  rankings += '\nTOP 10 BY ACTIVE STREAMS:\n';
  byStreams.slice(0, 10).forEach((node, i) => {
    rankings += `${i + 1}. ${node.address} (${node.network}) - ${node.activeStreams} streams | Credits: ${node.credits.toLocaleString()} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
  });

  // Top 10 by Packets (total transferred)
  const byPackets = [...onlineNodesWithCredits]
    .filter(n => n.packetsReceived || n.packetsSent)
    .sort((a, b) => ((b.packetsReceived || 0) + (b.packetsSent || 0)) - ((a.packetsReceived || 0) + (a.packetsSent || 0)));

  rankings += '\nTOP 10 BY PACKETS TRANSFERRED:\n';
  byPackets.slice(0, 10).forEach((node, i) => {
    const total = (node.packetsReceived || 0) + (node.packetsSent || 0);
    rankings += `${i + 1}. ${node.address} (${node.network}) - ${total.toLocaleString()} packets | Credits: ${node.credits.toLocaleString()} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
  });

  // Lowest CPU usage (most efficient)
  const byCpuLow = [...onlineNodesWithCredits]
    .filter(n => n.cpu !== null && n.cpu !== undefined)
    .sort((a, b) => (a.cpu || 0) - (b.cpu || 0));

  rankings += '\nTOP 10 LOWEST CPU (MOST EFFICIENT):\n';
  byCpuLow.slice(0, 10).forEach((node, i) => {
    rankings += `${i + 1}. ${node.address} (${node.network}) - CPU: ${node.cpu?.toFixed(1)}% | Credits: ${node.credits.toLocaleString()} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
  });

  // Highest CPU usage
  const byCpuHigh = [...onlineNodesWithCredits]
    .filter(n => n.cpu !== null && n.cpu !== undefined)
    .sort((a, b) => (b.cpu || 0) - (a.cpu || 0));

  rankings += '\nTOP 10 HIGHEST CPU:\n';
  byCpuHigh.slice(0, 10).forEach((node, i) => {
    rankings += `${i + 1}. ${node.address} (${node.network}) - CPU: ${node.cpu?.toFixed(1)}% | Credits: ${node.credits.toLocaleString()} | Pubkey: ${node.pubkey?.substring(0, 16)}...\n`;
  });

  // Total credits summary
  const totalCredits = nodesWithCredits.reduce((sum, n) => sum + (n.credits || 0), 0);
  rankings += `\nTOTAL NETWORK CREDITS: ${totalCredits.toLocaleString()}\n`;

  return rankings;
}

/**
 * Ask AI a question about the network
 */
async function askAI(question) {
  if (!aiModel) {
    return { success: false, error: 'AI is not configured. Please set GEMINI_API_KEY.' };
  }

  try {
    let additionalContext = '';

    // Check if question contains a pubkey or address (look for patterns)
    const pubkeyMatch = question.match(/[A-Za-z0-9]{20,}/);
    if (pubkeyMatch) {
      const node = findNodeByQuery(pubkeyMatch[0]);
      if (node) {
        additionalContext += '\n\n=== SPECIFIC NODE REQUESTED ===\n';
        additionalContext += await formatNodeInfo(node);
      }
    }

    // Get network context and rankings (both async)
    const networkContext = await getNetworkContext();
    const rankings = await getNodeRankings();

    const systemPrompt = `You are Xanalyze, an AI assistant specialized in Xandeum pNodes network monitoring and analysis.
You help users understand their node network status, analyze trends, and provide insights.

Current network data:
${networkContext}

${rankings}
${additionalContext}

Instructions:
- Your name is Xanalyze - introduce yourself when appropriate
- Answer questions based on the network data provided above
- Be concise and helpful
- Use numbers and percentages when relevant
- When asked about specific nodes, use the pubkey and address from the data
- When asked about rankings (top, best, highest, lowest, credits), use the NODE RANKINGS data
- Reputation Credits are a measure of node reliability and contribution to the network
- If asked about a specific pubkey/address, look in SPECIFIC NODE REQUESTED section
- If asked about something not in the data, say so
- Respond in the same language as the user's question
- Format responses for Telegram (use *bold* for emphasis, keep it readable)
- Maximum response length: 800 characters`;

    const result = await aiModel.generateContent([
      { text: systemPrompt },
      { text: `User question: ${question}` }
    ]);

    const response = result.response.text();
    return { success: true, response };
  } catch (error) {
    console.error('[AI] Error:', error);
    return { success: false, error: error.message };
  }
}

// Subscriber storage (in production, use MongoDB)
const subscribers = new Map(); // chatId -> Set of pubkeys
const nodeAlertHistory = new Map(); // pubkey -> last status

// Format bytes to human readable
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format uptime to human readable
function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Format number with commas
function formatNumber(num) {
  if (!num) return '0';
  return num.toLocaleString();
}

/**
 * Initialize the Telegram bot
 */
function initBot(token, geminiApiKey) {
  if (!token) {
    console.log('[Telegram] No bot token provided, skipping initialization');
    return null;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('[Telegram] Bot initialized');

  // Initialize AI if API key provided
  if (geminiApiKey) {
    initAI(geminiApiKey);
  }

  // Register command handlers
  registerCommands();

  return bot;
}

/**
 * Register all command handlers
 */
function registerCommands() {
  // /start - Welcome message
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const aiStatus = aiModel ? '✅' : '❌';
    const welcomeMessage = `
🌐 *Xandeum pNodes Monitor Bot*

Welcome! I can help you monitor Xandeum network nodes.

*Available Commands:*
/stats - Network overview (all networks)
/stats <network> - Specific network stats
/node <pubkey> - Check specific node
/versions - Version distribution
/compare - Compare all networks
/subscribe <pubkey> - Get alerts for a node
/unsubscribe <pubkey> - Stop alerts
/mysubs - List your subscriptions
/help - Show this help

🤖 *Xanalyze AI:* ${aiStatus}
/ask <question> - Ask AI about network
Or just send a message to chat with AI!

*Networks:* devnet1, devnet2, mainnet1, mainnet2
    `;
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  });

  // /help - Same as start
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const aiStatus = aiModel ? '✅' : '❌';
    const helpMessage = `
📖 *Commands Guide*

*Network Stats:*
/stats - All networks overview
/stats devnet1 - Specific network

*Node Monitoring:*
/node <pubkey> - Node details
/subscribe <pubkey> - Alert when node goes down/up
/unsubscribe <pubkey> - Remove alert
/mysubs - Your subscriptions

*Analysis:*
/versions - Software version distribution
/compare - Side-by-side network comparison
/top - Top nodes by uptime

🤖 *Xanalyze AI:* ${aiStatus}
/ask <question> - Ask AI about network
Or just send a message to chat with AI!

*Example AI Questions:*
• "Which node has the most credits?"
• "Top 5 nodes by uptime"
• "Total credits across all networks"

*Examples:*
\`/stats mainnet1\`
\`/node abc123...\`
\`/subscribe abc123...\`
\`/ask How many nodes are online?\`
    `;
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  });

  // /stats [network] - Network statistics
  bot.onText(/\/stats(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const network = match[1]?.toLowerCase();

    try {
      await bot.sendMessage(chatId, '⏳ Fetching stats...');

      const snapshots = await getLatestSnapshots();

      if (!snapshots || snapshots.length === 0) {
        await bot.sendMessage(chatId, '❌ No data available. Please try again later.');
        return;
      }

      if (network) {
        // Specific network
        const data = snapshots.find(s => s.network === network);
        if (!data) {
          await bot.sendMessage(chatId, `❌ Network "${network}" not found.\nAvailable: devnet1, devnet2, mainnet1, mainnet2`);
          return;
        }

        const message = formatNetworkStats(data);
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        // All networks summary
        let message = '📊 *Network Overview*\n\n';

        let totalNodes = 0;
        let totalOnline = 0;

        for (const data of snapshots) {
          const online = data.estimatedOnline || data.onlineNodes || 0;
          const total = data.totalPods || 0;
          const ratio = data.onlineRatio || 0;

          totalNodes += total;
          totalOnline += online;

          const statusEmoji = ratio >= 80 ? '🟢' : ratio >= 50 ? '🟡' : '🔴';
          message += `${statusEmoji} *${data.network}*: ${online}/${total} online (${ratio}%)\n`;
        }

        message += `\n📈 *Total:* ${totalOnline}/${totalNodes} nodes online`;
        message += `\n\n_Use /stats <network> for details_`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error('[Telegram] Stats error:', error);
      await bot.sendMessage(chatId, '❌ Error fetching stats. Please try again.');
    }
  });

  // /node <pubkey> - Node details
  bot.onText(/\/node\s+(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const pubkey = match[1];

    if (!pubkey || pubkey.length < 10) {
      await bot.sendMessage(chatId, '❌ Please provide a valid pubkey.\nUsage: `/node <pubkey>`', { parse_mode: 'Markdown' });
      return;
    }

    try {
      await bot.sendMessage(chatId, '🔍 Searching for node...');

      // Search in all networks
      const networks = ['devnet1', 'devnet2', 'mainnet1', 'mainnet2'];
      let foundNode = null;
      let foundNetwork = null;

      for (const network of networks) {
        const podsData = await fetchPods(network);
        if (podsData && podsData.pods) {
          const node = podsData.pods.find(p =>
            p.pubkey === pubkey ||
            p.pubkey?.startsWith(pubkey) ||
            p.address?.includes(pubkey)
          );
          if (node) {
            foundNode = node;
            foundNetwork = network;
            break;
          }
        }
      }

      if (!foundNode) {
        await bot.sendMessage(chatId, `❌ Node not found with pubkey: \`${pubkey.substring(0, 20)}...\``, { parse_mode: 'Markdown' });
        return;
      }

      // Get node history for more details
      const history = await getNodeHistory(foundNode.pubkey, 1);
      const latestStats = history?.[0];

      const statusEmoji = latestStats?.status === 'online' ? '🟢' : '🔴';
      const message = `
${statusEmoji} *Node Details*

*Network:* ${foundNetwork}
*Pubkey:* \`${foundNode.pubkey?.substring(0, 20)}...\`
*Address:* ${foundNode.address}
*Version:* ${latestStats?.version || foundNode.version || 'N/A'}

📊 *Stats:*
• Status: ${latestStats?.status || 'Unknown'}
• CPU: ${latestStats?.cpu?.toFixed(1) || 'N/A'}%
• RAM: ${latestStats?.ram?.toFixed(1) || 'N/A'}%
• Storage: ${formatBytes(latestStats?.storage)}
• Uptime: ${formatUptime(latestStats?.uptime)}

📡 *Activity:*
• Active Streams: ${formatNumber(latestStats?.activeStreams)}
• Packets Recv: ${formatNumber(latestStats?.packetsReceived)}
• Packets Sent: ${formatNumber(latestStats?.packetsSent)}
• Peers: ${formatNumber(latestStats?.peersCount)}

_Last seen: ${foundNode.last_seen_timestamp ? new Date(foundNode.last_seen_timestamp * 1000).toISOString() : 'N/A'}_
      `;

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Telegram] Node error:', error);
      await bot.sendMessage(chatId, '❌ Error fetching node data. Please try again.');
    }
  });

  // /versions - Version distribution
  bot.onText(/\/versions(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const network = match[1]?.toLowerCase();

    try {
      const snapshots = await getLatestSnapshots();

      if (!snapshots || snapshots.length === 0) {
        await bot.sendMessage(chatId, '❌ No data available.');
        return;
      }

      let message = '📦 *Version Distribution*\n\n';

      const networksToShow = network
        ? snapshots.filter(s => s.network === network)
        : snapshots;

      for (const data of networksToShow) {
        if (data.versionDistribution && Object.keys(data.versionDistribution).length > 0) {
          message += `*${data.network}:*\n`;

          const versions = Object.entries(data.versionDistribution)
            .sort((a, b) => b[1] - a[1]);

          const total = versions.reduce((sum, [, count]) => sum + count, 0);

          for (const [version, count] of versions.slice(0, 5)) {
            const percent = ((count / total) * 100).toFixed(1);
            const bar = '█'.repeat(Math.round(percent / 10));
            message += `  ${version}: ${count} (${percent}%) ${bar}\n`;
          }
          message += '\n';
        }
      }

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Telegram] Versions error:', error);
      await bot.sendMessage(chatId, '❌ Error fetching version data.');
    }
  });

  // /compare - Compare all networks
  bot.onText(/\/compare/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const snapshots = await getLatestSnapshots();

      if (!snapshots || snapshots.length === 0) {
        await bot.sendMessage(chatId, '❌ No data available.');
        return;
      }

      let message = '📊 *Network Comparison*\n\n';
      message += '```\n';
      message += 'Network   | Online | Total | Ratio | Storage\n';
      message += '----------|--------|-------|-------|--------\n';

      for (const data of snapshots) {
        const online = String(data.estimatedOnline || 0).padStart(6);
        const total = String(data.totalPods || 0).padStart(5);
        const ratio = String((data.onlineRatio || 0) + '%').padStart(5);
        const storage = formatBytes(data.totalStorage).padStart(8);
        message += `${data.network.padEnd(9)} | ${online} | ${total} | ${ratio} | ${storage}\n`;
      }

      message += '```';

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Telegram] Compare error:', error);
      await bot.sendMessage(chatId, '❌ Error comparing networks.');
    }
  });

  // /subscribe <pubkey> - Subscribe to node alerts
  bot.onText(/\/subscribe\s+(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const pubkey = match[1];

    if (!pubkey || pubkey.length < 10) {
      await bot.sendMessage(chatId, '❌ Please provide a valid pubkey.\nUsage: `/subscribe <pubkey>`', { parse_mode: 'Markdown' });
      return;
    }

    // Add to subscribers
    if (!subscribers.has(chatId)) {
      subscribers.set(chatId, new Set());
    }
    subscribers.get(chatId).add(pubkey);

    await bot.sendMessage(chatId, `✅ Subscribed to alerts for node:\n\`${pubkey.substring(0, 30)}...\`\n\nYou'll be notified when this node goes online/offline.`, { parse_mode: 'Markdown' });
  });

  // /unsubscribe <pubkey> - Unsubscribe from node alerts
  bot.onText(/\/unsubscribe\s+(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const pubkey = match[1];

    if (subscribers.has(chatId)) {
      subscribers.get(chatId).delete(pubkey);
      await bot.sendMessage(chatId, `✅ Unsubscribed from node:\n\`${pubkey.substring(0, 30)}...\``, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '❌ No subscriptions found.');
    }
  });

  // /mysubs - List subscriptions
  bot.onText(/\/mysubs/, async (msg) => {
    const chatId = msg.chat.id;

    const subs = subscribers.get(chatId);
    if (!subs || subs.size === 0) {
      await bot.sendMessage(chatId, '📭 You have no subscriptions.\n\nUse `/subscribe <pubkey>` to add one.', { parse_mode: 'Markdown' });
      return;
    }

    let message = '📋 *Your Subscriptions*\n\n';
    let i = 1;
    for (const pubkey of subs) {
      message += `${i}. \`${pubkey.substring(0, 30)}...\`\n`;
      i++;
    }
    message += `\n_Total: ${subs.size} subscription(s)_`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  });

  // /top - Top nodes by uptime
  bot.onText(/\/top(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const network = match[1]?.toLowerCase() || 'devnet1';

    try {
      await bot.sendMessage(chatId, '⏳ Fetching top nodes...');

      const latestData = getLatestData(network);
      if (!latestData || !latestData.nodeStats) {
        await bot.sendMessage(chatId, `❌ No data for ${network}.`);
        return;
      }

      const onlineNodes = latestData.nodeStats
        .filter(n => n.status === 'online' && n.uptime)
        .sort((a, b) => (b.uptime || 0) - (a.uptime || 0))
        .slice(0, 10);

      if (onlineNodes.length === 0) {
        await bot.sendMessage(chatId, '❌ No online nodes found.');
        return;
      }

      let message = `🏆 *Top 10 Nodes by Uptime (${network})*\n\n`;

      onlineNodes.forEach((node, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${formatUptime(node.uptime)} - \`${node.pubkey?.substring(0, 12)}...\`\n`;
      });

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Telegram] Top error:', error);
      await bot.sendMessage(chatId, '❌ Error fetching top nodes.');
    }
  });

  // /ask <question> - Ask AI about network
  bot.onText(/\/ask\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const question = match[1];

    if (!aiModel) {
      await bot.sendMessage(chatId, '❌ AI is not configured. Please ask the administrator to set GEMINI_API_KEY.');
      return;
    }

    try {
      await bot.sendMessage(chatId, '🤔 Thinking...');

      const result = await askAI(question);

      if (result.success) {
        await bot.sendMessage(chatId, `🤖 *Xanalyze:*\n\n${result.response}`, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, `❌ AI Error: ${result.error}`);
      }
    } catch (error) {
      console.error('[Telegram] Ask error:', error);
      await bot.sendMessage(chatId, '❌ Error processing your question.');
    }
  });

  // Handle regular messages (non-commands) - AI chat
  bot.on('message', async (msg) => {
    // Skip if it's a command
    if (msg.text?.startsWith('/')) return;
    // Skip if no text
    if (!msg.text) return;

    const chatId = msg.chat.id;

    // If AI is not configured, ignore non-command messages
    if (!aiModel) return;

    try {
      await bot.sendMessage(chatId, '🤔 Thinking...');

      const result = await askAI(msg.text);

      if (result.success) {
        await bot.sendMessage(chatId, `🤖 *Xanalyze:* ${result.response}`, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, `❌ AI Error: ${result.error}`);
      }
    } catch (error) {
      console.error('[Telegram] AI chat error:', error);
      await bot.sendMessage(chatId, '❌ Error processing your message.');
    }
  });

  console.log('[Telegram] Commands registered');
}

/**
 * Format network stats for display
 */
function formatNetworkStats(data) {
  const statusEmoji = data.onlineRatio >= 80 ? '🟢' : data.onlineRatio >= 50 ? '🟡' : '🔴';

  return `
${statusEmoji} *${data.network} Statistics*

📈 *Node Status:*
• Total Nodes: ${formatNumber(data.totalPods)}
• Online: ${formatNumber(data.estimatedOnline || data.onlineNodes)}
• Offline: ${formatNumber(data.estimatedOffline || data.offlineNodes)}
• Online Ratio: ${data.onlineRatio}%

💻 *Resources:*
• Avg CPU: ${data.avgCpu?.toFixed(1) || 'N/A'}%
• Avg RAM: ${data.avgRam?.toFixed(1) || 'N/A'}%
• Total Storage: ${formatBytes(data.totalStorage)}
• Avg Uptime: ${formatUptime(data.avgUptime)}

📡 *Activity:*
• Total Streams: ${formatNumber(data.totalStreams)}
• Bytes Transferred: ${formatBytes(data.totalBytesTransferred)}

_Last updated: ${data.timestamp ? new Date(data.timestamp).toISOString() : 'N/A'}_
  `;
}

/**
 * Send alert to all subscribers of a node
 */
async function sendNodeAlert(pubkey, status, nodeInfo) {
  if (!bot) return;

  const emoji = status === 'online' ? '🟢' : '🔴';
  const message = `
${emoji} *Node Status Alert*

Node \`${pubkey.substring(0, 30)}...\` is now *${status.toUpperCase()}*

${nodeInfo ? `Network: ${nodeInfo.network}\nAddress: ${nodeInfo.address}` : ''}

_${new Date().toISOString()}_
  `;

  for (const [chatId, subs] of subscribers) {
    if (subs.has(pubkey)) {
      try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`[Telegram] Failed to send alert to ${chatId}:`, error.message);
      }
    }
  }
}

/**
 * Check for node status changes and send alerts
 */
async function checkNodeAlerts(nodeStats) {
  if (!bot || subscribers.size === 0) return;

  for (const node of nodeStats) {
    const pubkey = node.pubkey;
    if (!pubkey) continue;

    const previousStatus = nodeAlertHistory.get(pubkey);
    const currentStatus = node.status;

    // Check if status changed
    if (previousStatus && previousStatus !== currentStatus) {
      // Check if anyone is subscribed to this node
      for (const [, subs] of subscribers) {
        if (subs.has(pubkey)) {
          await sendNodeAlert(pubkey, currentStatus, node);
          break;
        }
      }
    }

    // Update history
    nodeAlertHistory.set(pubkey, currentStatus);
  }
}

/**
 * Broadcast message to all users who have interacted with the bot
 */
async function broadcastAlert(message) {
  if (!bot) return;

  for (const chatId of subscribers.keys()) {
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`[Telegram] Broadcast failed for ${chatId}:`, error.message);
    }
  }
}

/**
 * Get bot instance
 */
function getBot() {
  return bot;
}

/**
 * Stop the bot
 */
function stopBot() {
  if (bot) {
    bot.stopPolling();
    console.log('[Telegram] Bot stopped');
  }
}

module.exports = {
  initBot,
  getBot,
  stopBot,
  sendNodeAlert,
  checkNodeAlerts,
  broadcastAlert,
  askAI,
  getNetworkContext,
};
