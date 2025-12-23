# Xandeum RPC Proxy

Backend proxy server to bypass Cloudflare restrictions on Xandeum RPC endpoints, with MongoDB integration for historical data, charts, AI assistant, and Telegram bot.

## Features

- RPC Proxy to bypass Cloudflare
- In-memory caching (1 minute TTL)
- MongoDB integration for historical data
- Automatic data collection (all nodes)
- Pre-formatted chart data APIs
- TTL indexes (auto-delete data after 30 days)
- **Xanalyze AI** (Gemini 2.0 Flash) for network analysis
- **Telegram Bot** for monitoring and alerts

## Endpoints

### RPC Proxy

| Method | Endpoint             | Description                                                    |
| ------ | -------------------- | -------------------------------------------------------------- |
| GET    | `/`                  | Health check                                                   |
| GET    | `/health`            | Health status with MongoDB connection                          |
| GET    | `/api/pods/:network` | Get pods from a network (devnet1, devnet2, mainnet1, mainnet2) |
| GET    | `/api/pods`          | Get pods from all networks                                     |
| POST   | `/api/rpc`           | Proxy any RPC call                                             |
| GET    | `/api/node/:ip`      | Get node data (version, stats, pods)                           |
| POST   | `/api/nodes/batch`   | Batch get multiple nodes                                       |

### Historical Data (Charts)

| Method | Endpoint                        | Description                          |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/api/history/network/:network` | Historical data for a network        |
| GET    | `/api/history/node/:address`    | Historical data for a node           |
| GET    | `/api/history/stats`            | Aggregated stats across all networks |
| GET    | `/api/history/latest`           | Latest cached data from collector    |
| GET    | `/api/charts/network/:network`  | Pre-formatted chart data             |
| GET    | `/api/charts/comparison`        | Compare multiple networks            |

### Pod Credits API

| Method | Endpoint           | Description                       |
| ------ | ------------------ | --------------------------------- |
| GET    | `/api/pod-credits` | Get reputation credits for all pods |

### AI Chat API

| Method | Endpoint         | Description                    |
| ------ | ---------------- | ------------------------------ |
| GET    | `/api/ai/status` | Check if AI is available       |
| POST   | `/api/ai/ask`    | Ask AI about network status    |

### Query Parameters

**Period options:** `1h`, `6h`, `24h`, `7d`, `30d` (default: `24h`)

**Interval options:** `1m`, `5m`, `15m`, `1h`, `6h` (default: `15m`)

## MongoDB Collections

| Collection          | Description              | TTL     |
| ------------------- | ------------------------ | ------- |
| `network_snapshots` | Aggregated network stats | 30 days |
| `node_history`      | Individual node stats    | 30 days |
| `pods_snapshots`    | Pods list snapshots      | -       |

## Deploy to Render

1. Create a new Web Service on [render.com](https://render.com)
2. Connect your GitHub repo
3. Set:
   - **Root Directory:** `proxy-server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** `Node`
4. Add environment variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `ALLOWED_ORIGINS` - Your frontend domains (comma-separated)

## Environment Variables

| Variable             | Default          | Description                                |
| -------------------- | ---------------- | ------------------------------------------ |
| PORT                 | 3001             | Server port                                |
| ALLOWED_ORIGINS      | \*               | Comma-separated list of allowed origins    |
| MONGODB_URI          | -                | MongoDB connection URI                     |
| COLLECTOR_SCHEDULE   | \*/5 \* \* \* \* | Cron schedule for data collection          |
| COLLECTOR_BATCH_SIZE | 10               | Nodes to process in parallel per batch     |
| TELEGRAM_BOT_TOKEN   | -                | Telegram bot token from @BotFather         |
| GEMINI_API_KEY       | -                | Google Gemini API key for AI features      |

## Usage Examples

### Get pods from devnet1

```javascript
const response = await fetch(
  "https://your-proxy.onrender.com/api/pods/devnet1"
);
const data = await response.json();
```

### Proxy RPC call

```javascript
const response = await fetch("https://your-proxy.onrender.com/api/rpc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    endpoint: "https://rpc1.pchednode.com/rpc",
    method: "get-pods",
  }),
});
```

### Get chart data for 24h

```javascript
const response = await fetch(
  "https://your-proxy.onrender.com/api/charts/network/devnet1?period=24h"
);
const { charts } = await response.json();

// charts.nodes - Node count over time
// charts.resources - CPU/RAM usage over time
// charts.storage - Storage and streams over time
```

### Compare networks

```javascript
const response = await fetch(
  "https://your-proxy.onrender.com/api/charts/comparison?period=7d"
);
const { data } = await response.json();

// data.devnet1, data.devnet2, data.mainnet1, data.mainnet2
```

### Get Pod Credits

```javascript
const response = await fetch("https://your-proxy.onrender.com/api/pod-credits");
const { pods_credits, status } = await response.json();

// {
//   "pods_credits": [
//     { "pod_id": "27V3s7gCKHiACfNHnrnzr3...", "credits": 51885 },
//     { "pod_id": "2FrB4NYAeMDu16SG2nbigc...", "credits": 3773 }
//   ],
//   "status": "success"
// }
```

### AI Chat - Check Status

```javascript
const response = await fetch("https://your-proxy.onrender.com/api/ai/status");
const { aiEnabled, model } = await response.json();

// { success: true, aiEnabled: true, model: "gemini-2.0-flash" }
```

### AI Chat - Ask Question

```javascript
const response = await fetch("https://your-proxy.onrender.com/api/ai/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    question: "How many nodes are online?",
  }),
});
const { answer, timestamp } = await response.json();

// {
//   success: true,
//   question: "How many nodes are online?",
//   answer: "Total online nodes: 74 (15%) across all networks.",
//   timestamp: "2025-12-23T16:17:06.952Z"
// }
```

**Example AI Questions:**
- "How many nodes are online?"
- "Which network has the highest online ratio?"
- "What's the average CPU usage across all networks?"
- "Compare devnet and mainnet performance"
- "Summarize network health status"
- "Which node has the most credits?"
- "Top 5 nodes by reputation credits"
- "Total credits across all networks"

## Telegram Bot

The server includes an optional Telegram bot for monitoring nodes.

### Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get your bot token
3. Set `TELEGRAM_BOT_TOKEN` in `.env`
4. (Optional) Set `GEMINI_API_KEY` for AI features

### Bot Commands

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `/start`                | Welcome message                  |
| `/stats`                | All networks overview            |
| `/stats <network>`      | Specific network stats           |
| `/node <pubkey>`        | Node details                     |
| `/versions`             | Version distribution             |
| `/compare`              | Compare all networks             |
| `/top`                  | Top 10 nodes by uptime           |
| `/subscribe <pubkey>`   | Get alerts when node goes down   |
| `/unsubscribe <pubkey>` | Stop alerts for a node           |
| `/mysubs`               | List your subscriptions          |
| `/ask <question>`       | Ask AI about network (if enabled)|

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB credentials

# Start server
npm start
# Server runs on http://localhost:3001
```

## MongoDB Setup

1. Create a free MongoDB Atlas cluster at [mongodb.com](https://www.mongodb.com/cloud/atlas)
2. Create a database user with read/write access
3. Add your IP to the network access list (or allow all IPs: `0.0.0.0/0`)
4. Get your connection string and set it as `MONGODB_URI`

## Data Collection

The server automatically collects data every 5 minutes (configurable via `COLLECTOR_SCHEDULE`):

1. Fetches pods list from all RPC endpoints
2. Collects detailed stats from **ALL nodes** (configurable batch size)
3. Calculates aggregated metrics (online/offline, CPU, RAM, storage)
4. Saves snapshots to MongoDB
5. Sends Telegram alerts for node status changes (if subscribed)
6. Old data is automatically deleted after 30 days (TTL index)

## Chart Data Format

The `/api/charts/network/:network` endpoint returns pre-formatted data for recharts:

```json
{
  "success": true,
  "network": "devnet1",
  "period": "24h",
  "charts": {
    "nodes": [
      { "time": 1702800000000, "online": 150, "offline": 10, "total": 204 }
    ],
    "resources": [{ "time": 1702800000000, "cpu": 25.5, "ram": 45.2 }],
    "storage": [{ "time": 1702800000000, "storage": 1073741824, "streams": 50 }]
  }
}
```

## Deploy to VPS

```bash
# Clone and navigate
cd proxy-server

# Install dependencies
npm install

# Create .env file with MONGODB_URI

# Run with PM2
npm install -g pm2
pm2 start server.js --name xandeum-proxy
pm2 save
```
