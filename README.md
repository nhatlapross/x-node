# Xandeum pNodes Analytics Platform

A web-based analytics platform for monitoring Xandeum pNodes network, similar to Solana validator dashboards like [stakewiz.com](https://stakewiz.com) and [validators.app](https://validators.app).

## Live Demo

**Frontend:** [https://xnode.vercel.app](https://xnode.vercel.app)

**Backend API:** [https://x-node.onrender.com](https://x-node.onrender.com)

## About Xandeum

Xandeum is building a scalable storage layer for Solana dApps - a second tier of Solana accounts that can grow to exabytes and beyond. This lives on its own network of storage provider nodes called **pNodes**.

## Features

### Dashboard
- Real-time pNode network statistics
- Online/Offline node counts
- Total storage capacity across network
- Average CPU and RAM utilization
- Version distribution analysis
- Pod credits tracking

### Node Explorer
- Detailed view of all pNodes from gossip network
- Individual node stats (CPU, RAM, Storage, Uptime)
- Node version information
- Active streams and peer connections
- Geolocation data with country flags
- Search and filter by status, version, address

### Network Topology (3D Globe)
- Interactive 3D visualization of global pNode distribution
- Real-time node connections visualization
- Color-coded by version status (latest, outdated, offline)
- Bidirectional connection indicators
- Click to view node details

### Token Activity (XAND)
- Live XAND token price and market cap
- Recent transfers and transactions
- Top holders distribution
- DeFi activity tracking
- Price and volume charts
- Data from Solscan API

### Historical Data & Charts
- Network statistics over time (1h, 6h, 24h, 7d, 30d)
- Node count trends (online/offline/total nodes)
- Resource utilization history (CPU, RAM, Storage)
- Storage capacity tracking over time
- Pod credits accumulation and usage
- MongoDB-backed data persistence
- Auto-collection every 5 minutes
- Interactive charts with zoom and pan capabilities
- Export historical data to CSV format
- Data aggregation for performance optimization
- Real-time chart updates without page refresh

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| 3D Visualization | react-globe.gl, Three.js |
| Charts | Recharts |
| Backend Proxy | Express.js, Node.js |
| Database | MongoDB Atlas |
| Caching | IndexedDB (client), In-memory (server) |
| Deployment | Vercel (frontend), Render (backend) |

## How It Works

### pRPC (pNode RPC) Integration

The platform retrieves pNode data using pRPC calls as documented at [xandeum.network](https://xandeum.network):

```javascript
// Get list of all pNodes from network gossip
POST /rpc
{
  "jsonrpc": "2.0",
  "method": "get-pods",
  "id": 1
}

// Get individual node version
POST /rpc
{
  "jsonrpc": "2.0",
  "method": "get-version",
  "id": 1
}

// Get node statistics
POST /rpc
{
  "jsonrpc": "2.0",
  "method": "get-stats",
  "id": 1
}
```

### Historical Data Collection

The platform runs a background data collector that:

1. Fetches pNode statistics from all network endpoints every 5 minutes
2. Stores aggregated data in MongoDB with timestamp indexing
3. Calculates historical trends and metrics
4. Updates charts with real-time data
5. Implements data retention policies (keeps last 30 days of detailed data)
6. Provides aggregated data points for older time ranges

#### MongoDB Schema

```javascript
// Historical network statistics collection
{
  timestamp: Date,           // Indexed for efficient queries
  network: String,          // devnet1, devnet2, mainnet1, mainnet2
  totalNodes: Number,
  onlineNodes: Number,
  offlineNodes: Number,
  totalStorage: Number,     // In GB
  avgCpuUsage: Number,      // Percentage
  avgRamUsage: Number,      // Percentage
  versions: [{
    version: String,
    count: Number
  }],
  totalPodCredits: Number,
  createdAt: Date
}
```

#### Data Aggregation Strategy

- **Raw data**: Collected every 5 minutes (last 24 hours)
- **Hourly averages**: Aggregated from raw data (last 7 days)
- **Daily summaries**: Aggregated from hourly data (last 30 days)
- **Compression**: Older data is compressed to reduce storage

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Proxy Server   │────▶│   pNode RPCs    │
│  (Next.js)      │     │  (Express)      │     │ (Cloudflare)    │
│  Vercel         │     │  Render         │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │                     ▲
                                 ▼                     │
                        ┌─────────────────┐             │
                        │   MongoDB       │             │
                        │   (Historical)  │             │
                        └─────────────────┘             │
                       ▲                              │
                       │                              │
                ┌──────┴───────┐                      │
                │ Data Collector│ ◄──────────────────┘
                │ (Cron Job)   │  Every 5 minutes
                └──────────────┘
```

### Network Endpoints

| Network | RPC Endpoint |
|---------|-------------|
| Devnet 1 | https://rpc1.pchednode.com/rpc |
| Devnet 2 | https://rpc2.pchednode.com/rpc |
| Mainnet 1 | https://rpc3.pchednode.com/rpc |
| Mainnet 2 | https://rpc4.pchednode.com/rpc |

## Screenshots

### Dashboard View
- Network overview with key metrics
- Node cards with status indicators
- Table view with sorting and filtering

### Topology View
- 3D globe visualization
- Node distribution by geography
- Connection lines between peers

### Activity View
- Token price charts
- Transfer history
- Holder distribution

### Historical Charts View
- Interactive time-series charts for all network metrics
- Zoomable and scrollable chart interface
- Time range selector (1h, 6h, 24h, 7d, 30d)
- Multi-metric overlay support
- Real-time data updates
- Export functionality for data analysis

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm (recommended) or npm
- MongoDB Atlas account (for historical data)

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/nhatlapross/xandeum-pnodes.git
cd xandeum-pnodes

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Backend Proxy Setup

```bash
cd proxy-server

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Add your MongoDB URI

# Run server
npm start
```

Server runs on [http://localhost:3001](http://localhost:3001).

## Environment Variables

### Frontend (.env)

```env
# Proxy server URL
NEXT_PUBLIC_PROXY_URL=https://x-node.onrender.com

# Helius API Key (optional - for Solana RPC)
HELIUS_API_KEY=your-api-key
```

### Backend (proxy-server/.env)

```env
PORT=3001
MONGODB_URI=your-mongo-url
ALLOWED_ORIGINS=https://your-frontend.com
COLLECTOR_SCHEDULE=*/5 * * * *
```

## API Endpoints

### Proxy Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pods/:network` | Get pNodes from network |
| GET | `/api/pods` | Get pNodes from all networks |
| POST | `/api/rpc` | Proxy any pRPC call |
| GET | `/api/node/:ip` | Get individual node data |
| GET | `/api/charts/network/:network` | Historical chart data |
| GET | `/api/history/:network?range=24h` | Get historical data for specific time range |
| GET | `/api/history/export/:network?format=csv` | Export historical data |

#### Historical Data API Parameters

**Query Parameters for `/api/history/:network`:**
- `range`: Time range (`1h`, `6h`, `24h`, `7d`, `30d`) - default: `24h`
- `aggregation`: Data aggregation level (`raw`, `hourly`, `daily`) - default: auto
- `metrics`: Specific metrics to return (comma-separated) - default: all

**Response Format:**
```json
{
  "success": true,
  "data": {
    "timestamps": ["2024-01-01T00:00:00Z", ...],
    "totalNodes": [100, 102, 101, ...],
    "onlineNodes": [95, 97, 96, ...],
    "avgCpuUsage": [45.2, 46.1, 44.8, ...],
    "totalStorage": [1024, 1030, 1028, ...]
  },
  "summary": {
    "min": {...},
    "max": {...},
    "avg": {...}
  }
}
```

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import project to [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Backend (Render)

1. Create Web Service on [Render](https://render.com)
2. Connect GitHub repository
3. Set root directory: `proxy-server`
4. Add environment variables (MONGODB_URI)
5. Deploy

## Project Structure

```
xandeum-pnodes/
├── app/                    # Next.js app router
│   ├── page.tsx           # Dashboard (main)
│   ├── topology/          # 3D globe view
│   ├── activity/          # Token activity
│   └── api/               # API routes
├── components/
│   ├── dashboard/         # Node cards, stats
│   ├── globe/             # 3D visualization
│   ├── layout/            # Page layouts
│   └── ui/                # shadcn components
├── lib/                   # Utilities
│   ├── proxyConfig.ts     # Proxy configuration
│   ├── geolocation.ts     # IP geolocation
│   └── indexedDB.ts       # Client caching
├── proxy-server/          # Backend proxy
│   ├── server.js          # Express server
│   └── lib/
│       ├── mongodb.js     # Database module
│       └── dataCollector.js # Cron collector
└── docs/                  # Documentation
```

## Bounty Compliance

| Requirement | Status |
|-------------|--------|
| Web-based analytics platform | ✅ |
| Retrieve pNodes from gossip via pRPC | ✅ |
| Display pNode information | ✅ |
| Live, functional website | ✅ |
| Documentation | ✅ |
| Clear information display | ✅ |
| User-friendly interface | ✅ |
| Innovation (3D globe, charts, historical data) | ✅ |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Links

- [Xandeum Website](https://xandeum.network)
- [Xandeum Documentation](https://xandeum.network/docs)
- [Xandeum Discord](https://discord.gg/uqRSmmM5m)
- [Live Demo](https://xnode.vercel.app)
