# Xandeum RPC Proxy

Backend proxy server to bypass Cloudflare restrictions on Xandeum RPC endpoints.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/pods/:network` | Get pods from a network (devnet1, devnet2, mainnet1, mainnet2) |
| GET | `/api/pods` | Get pods from all networks |
| POST | `/api/rpc` | Proxy any RPC call |
| GET | `/api/node/:ip` | Get node data (version, stats, pods) |
| POST | `/api/nodes/batch` | Batch get multiple nodes |

## Deploy to Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login:
```bash
railway login
```

3. Initialize project:
```bash
cd proxy-server
railway init
```

4. Deploy:
```bash
railway up
```

5. Get URL:
```bash
railway domain
```

## Deploy to Render

1. Create a new Web Service on [render.com](https://render.com)
2. Connect your GitHub repo
3. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

## Deploy to VPS

```bash
# Clone and navigate
cd proxy-server

# Install dependencies
npm install

# Run with PM2
npm install -g pm2
pm2 start server.js --name xandeum-proxy
pm2 save
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |
| ALLOWED_ORIGINS | * | Comma-separated list of allowed origins |

## Usage Example

```javascript
// Get pods from devnet1
const response = await fetch('https://your-proxy.railway.app/api/pods/devnet1');
const data = await response.json();

// Proxy RPC call
const response = await fetch('https://your-proxy.railway.app/api/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: 'https://rpc1.pchednode.com/rpc',
    method: 'get-pods'
  })
});
```

## Local Development

```bash
npm install
npm start
# Server runs on http://localhost:3001
```
