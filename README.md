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
- Node count trends
- Resource utilization history
- MongoDB-backed data persistence
- Auto-collection every 5 minutes

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

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Proxy Server   │────▶│   pNode RPCs    │
│  (Next.js)      │     │  (Express)      │     │ (Cloudflare)    │
│  Vercel         │     │  Render         │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   MongoDB       │
                        │   (Historical)  │
                        └─────────────────┘
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
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
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
