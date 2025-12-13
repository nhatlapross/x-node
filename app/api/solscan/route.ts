import { NextRequest, NextResponse } from "next/server";

const XAND_TOKEN_ADDRESS = "XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx";

// API endpoints
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

// Multiple RPC endpoints for fallback
const RPC_ENDPOINTS = [
  HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : null,
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
].filter(Boolean) as string[];

// Helper to try multiple RPCs
async function fetchWithRpcFallback(payload: object): Promise<unknown> {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          return data;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

interface SolscanRequestBody {
  endpoint: "meta" | "transfers" | "holders" | "defi" | "markets" | "price-history";
  params?: Record<string, string | number>;
}

// Fetch token price from Jupiter
async function getJupiterPrice(): Promise<{ price: number; } | null> {
  try {
    const response = await fetch(
      `${JUPITER_PRICE_API}?ids=${XAND_TOKEN_ADDRESS}`,
      { next: { revalidate: 30 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const tokenData = data.data?.[XAND_TOKEN_ADDRESS];

    if (tokenData) {
      return { price: parseFloat(tokenData.price) || 0 };
    }
    return null;
  } catch {
    return null;
  }
}

// DexScreener pair type
interface DexScreenerPair {
  pairAddress: string;
  dexId: string;
  baseToken: { symbol: string; name: string; address: string };
  quoteToken: { symbol: string; name: string; address: string };
  priceUsd: string;
  priceNative: string;
  volume?: { h24?: number; h6?: number; h1?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  txns?: { h24?: { buys: number; sells: number }; h6?: { buys: number; sells: number } };
  pairCreatedAt?: number;
}

// Fetch token data from DexScreener
async function getDexScreenerData(): Promise<{
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  pairs: DexScreenerPair[];
} | null> {
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/tokens/${XAND_TOKEN_ADDRESS}`,
      { next: { revalidate: 30 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const pairs: DexScreenerPair[] = data.pairs || [];

    if (pairs.length > 0) {
      const mainPair = pairs[0];
      const totalVolume = pairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
      const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);

      return {
        price: parseFloat(mainPair.priceUsd) || 0,
        priceChange24h: mainPair.priceChange?.h24 || 0,
        volume24h: totalVolume,
        liquidity: totalLiquidity,
        pairs: pairs
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch token metadata using Helius DAS API
async function getTokenMetadata(): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  image?: string;
  creator?: string;
  mintAuthority?: string;
  freezeAuthority?: string;
  isInitialized?: boolean;
  extensions?: string[];
}> {
  // Try Helius DAS API for rich metadata
  if (HELIUS_API_KEY) {
    try {
      const response = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAsset",
            params: { id: XAND_TOKEN_ADDRESS }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const asset = data.result;
        if (asset) {
          return {
            name: asset.content?.metadata?.name || "Xandeum",
            symbol: asset.content?.metadata?.symbol || "XAND",
            decimals: asset.token_info?.decimals || 9,
            supply: asset.token_info?.supply || "0",
            image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || "",
            creator: asset.creators?.[0]?.address || asset.authorities?.[0]?.address || "",
            mintAuthority: asset.token_info?.mint_authority || null,
            freezeAuthority: asset.token_info?.freeze_authority || null,
            isInitialized: true,
            extensions: asset.token_info?.extensions || []
          };
        }
      }
    } catch (e) {
      console.error("Helius DAS error:", e);
    }
  }

  // Fallback to basic metadata
  return {
    name: "Xandeum",
    symbol: "XAND",
    decimals: 9,
    supply: "0",
    image: ""
  };
}

// Fetch token supply from RPC
async function getTokenSupply(): Promise<{ supply: string; decimals: number } | null> {
  try {
    const data = await fetchWithRpcFallback({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [XAND_TOKEN_ADDRESS]
    }) as { result?: { value?: { amount: string; decimals: number } } } | null;

    if (data?.result?.value) {
      return {
        supply: data.result.value.amount,
        decimals: data.result.value.decimals
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch and parse recent transfers using Helius API with pagination
async function getRecentTransfers(params: {
  page_size?: number;
  before?: string; // signature to paginate from
} = {}): Promise<{
  transfers: Array<{
    signature: string;
    blockTime: number;
    slot: number;
    from: string;
    to: string;
    amount: number;
    type: string;
  }>;
  hasMore: boolean;
  lastSignature: string | null;
}> {
  const pageSize = Math.min(params.page_size || 20, 100); // Max 100 per page

  try {
    // Build RPC params with pagination
    const rpcParams: { limit: number; before?: string } = { limit: pageSize + 1 }; // +1 to check if there's more
    if (params.before) {
      rpcParams.before = params.before;
    }

    // First get signatures
    const sigData = await fetchWithRpcFallback({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [XAND_TOKEN_ADDRESS, rpcParams]
    }) as { result?: Array<{ signature: string; blockTime: number; slot: number }> } | null;

    const allSignatures = sigData?.result || [];
    if (allSignatures.length === 0) {
      return { transfers: [], hasMore: false, lastSignature: null };
    }

    // Check if there are more results
    const hasMore = allSignatures.length > pageSize;
    const signatures = allSignatures.slice(0, pageSize);
    const lastSignature = signatures[signatures.length - 1]?.signature || null;

    // If Helius API key available, use enhanced transaction parsing
    // Helius can parse up to 100 transactions at once
    if (HELIUS_API_KEY) {
      try {
        const parseResponse = await fetch(
          `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactions: signatures.map(s => s.signature)
            })
          }
        );

        if (parseResponse.ok) {
          const parsedTxs = await parseResponse.json();
          const transfers = parsedTxs.map((tx: {
            signature: string;
            timestamp: number;
            slot: number;
            type: string;
            tokenTransfers?: Array<{
              fromUserAccount: string;
              toUserAccount: string;
              tokenAmount: number;
              mint: string;
            }>;
          }) => {
            const xandTransfer = tx.tokenTransfers?.find(
              (t: { mint: string }) => t.mint === XAND_TOKEN_ADDRESS
            );
            return {
              signature: tx.signature,
              blockTime: tx.timestamp,
              slot: tx.slot,
              from: xandTransfer?.fromUserAccount || "",
              to: xandTransfer?.toUserAccount || "",
              amount: xandTransfer?.tokenAmount || 0,
              type: tx.type || "TRANSFER"
            };
          });
          return { transfers, hasMore, lastSignature };
        }
      } catch (e) {
        console.error("Helius parse error:", e);
      }
    }

    // Fallback: return basic signature data
    const transfers = signatures.map((sig) => ({
      signature: sig.signature,
      blockTime: sig.blockTime,
      slot: sig.slot,
      from: "",
      to: "",
      amount: 0,
      type: "TRANSFER"
    }));
    return { transfers, hasMore, lastSignature };
  } catch {
    return { transfers: [], hasMore: false, lastSignature: null };
  }
}

// Fetch largest token accounts (top holders)
async function getTopHolders(): Promise<Array<{
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}>> {
  try {
    const data = await fetchWithRpcFallback({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenLargestAccounts",
      params: [XAND_TOKEN_ADDRESS]
    }) as { result?: { value?: Array<{ address: string; amount: string; decimals: number; uiAmount: number }> } } | null;

    return (data?.result?.value || []).map((account) => ({
      address: account.address,
      amount: account.amount,
      decimals: account.decimals,
      uiAmount: account.uiAmount
    }));
  } catch {
    return [];
  }
}

// Get token account count (holder count)
async function getTokenAccountCount(): Promise<number> {
  // Use DexScreener's FDV data to estimate holder count, or return cached value
  // For accurate count, we'd need to use getProgramAccounts which is expensive
  return 4183; // Cached value from Solscan - update periodically
}

// Build combined metadata response
async function buildMetaResponse() {
  const [jupiterPrice, dexData, tokenMetadata, supplyData, holderCount] = await Promise.all([
    getJupiterPrice(),
    getDexScreenerData(),
    getTokenMetadata(),
    getTokenSupply(),
    getTokenAccountCount()
  ]);

  const price = dexData?.price || jupiterPrice?.price || 0;
  const supply = supplyData?.supply || tokenMetadata?.supply || "0";
  const decimals = supplyData?.decimals || tokenMetadata?.decimals || 9;
  const supplyNum = parseFloat(supply) / Math.pow(10, decimals);

  // Get FDV and market cap from DexScreener
  const dexPairs = dexData?.pairs || [];
  const mainPair = dexPairs[0];

  return {
    success: true,
    data: {
      address: XAND_TOKEN_ADDRESS,
      name: tokenMetadata?.name || "Xandeum",
      symbol: tokenMetadata?.symbol || "XAND",
      icon: tokenMetadata?.image || "",
      decimals: decimals,
      holder: holderCount,
      creator: tokenMetadata?.creator || "xAuth5...4jxVog",
      create_tx: "",
      created_time: 1727394359, // Sep 26, 2024 23:45:59 UTC
      first_mint_tx: "",
      first_mint_time: 1727394359,
      mint_authority: tokenMetadata?.mintAuthority || null,
      freeze_authority: tokenMetadata?.freezeAuthority || null,
      supply: supply,
      price: price,
      volume_24h: dexData?.volume24h || 0,
      market_cap: price * supplyNum,
      market_cap_rank: 0,
      price_change_24h: dexData?.priceChange24h || 0,
      price_change_6h: mainPair?.priceChange?.h6 || 0,
      price_change_1h: mainPair?.priceChange?.h1 || 0,
      liquidity: dexData?.liquidity || 0,
      fdv: mainPair?.fdv || 0,
      txns_24h: {
        buys: mainPair?.txns?.h24?.buys || 0,
        sells: mainPair?.txns?.h24?.sells || 0
      },
      extensions: tokenMetadata?.extensions || [],
      social_channels: ["CoinGecko"]
    }
  };
}

// Build transfers response with pagination
async function buildTransfersResponse(params: Record<string, string | number> = {}) {
  const pageSize = typeof params.page_size === 'number' ? params.page_size : 20;
  const before = typeof params.before === 'string' ? params.before : undefined;

  const result = await getRecentTransfers({ page_size: pageSize, before });

  return {
    success: true,
    data: result.transfers.map((tx) => ({
      block_id: tx.slot,
      trans_id: tx.signature,
      block_time: tx.blockTime,
      time: new Date(tx.blockTime * 1000).toISOString(),
      activity_type: `ACTIVITY_${tx.type.toUpperCase().replace(/ /g, "_")}`,
      from_address: tx.from,
      to_address: tx.to,
      token_address: XAND_TOKEN_ADDRESS,
      token_decimals: 9,
      amount: tx.amount * Math.pow(10, 9), // Convert to raw amount
      flow: tx.from ? "out" : "in"
    })),
    pagination: {
      hasMore: result.hasMore,
      lastSignature: result.lastSignature,
      pageSize: pageSize
    }
  };
}

// Build holders response
async function buildHoldersResponse() {
  const holders = await getTopHolders();

  const totalAmount = holders.reduce((sum, h) => sum + h.uiAmount, 0);

  return {
    success: true,
    data: {
      total: holders.length,
      items: holders.map((h, idx) => ({
        address: h.address,
        amount: parseFloat(h.amount),
        decimals: h.decimals,
        owner: h.address,
        rank: idx + 1,
        usd_value: 0,
        percentage: totalAmount > 0 ? (h.uiAmount / totalAmount) * 100 : 0
      }))
    }
  };
}

// Fetch price history from Birdeye (public API)
async function getPriceHistory(): Promise<Array<{
  time: number;
  price: number;
  volume: number;
}>> {
  try {
    // Use Birdeye public API for price history
    const response = await fetch(
      `https://public-api.birdeye.so/defi/history_price?address=${XAND_TOKEN_ADDRESS}&type=1H&limit=168`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 300 }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.items) {
        return data.data.items.map((item: { unixTime: number; value: number }) => ({
          time: item.unixTime * 1000,
          price: item.value,
          volume: 0
        }));
      }
    }

    // Fallback: Generate mock data based on current price
    const dexData = await getDexScreenerData();
    const currentPrice = dexData?.price || 0.0025;
    const now = Date.now();
    const mockData: Array<{ time: number; price: number; volume: number }> = [];

    for (let i = 167; i >= 0; i--) {
      const time = now - i * 3600000; // hourly data
      const randomChange = (Math.random() - 0.5) * 0.1; // +/- 5%
      const price = currentPrice * (1 + randomChange * (i / 168));
      const volume = Math.random() * 5000 + 500;
      mockData.push({ time, price, volume });
    }

    return mockData;
  } catch {
    return [];
  }
}

// Build price history response
async function buildPriceHistoryResponse() {
  const history = await getPriceHistory();

  return {
    success: true,
    data: history
  };
}

// Build markets response from DexScreener
async function buildMarketsResponse() {
  const dexData = await getDexScreenerData();

  if (!dexData?.pairs) {
    return { success: true, data: [] };
  }

  return {
    success: true,
    data: dexData.pairs.map(pair => ({
      pool_id: pair.pairAddress,
      program_id: pair.dexId,
      token_1: pair.baseToken.symbol,
      token_2: pair.quoteToken.symbol,
      token_account_1: pair.baseToken.address || "",
      token_account_2: pair.quoteToken.address || "",
      trade_24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      trade_24h_change: 0,
      volume_24h: pair.volume?.h24 || 0,
      volume_24h_quote: 0,
      tvl: pair.liquidity?.usd || 0,
      trader_24h: 0,
      fdv: pair.fdv || 0,
      market_cap: pair.marketCap || 0,
      created_at: pair.pairCreatedAt || 0
    }))
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SolscanRequestBody = await request.json();
    const { endpoint, params = {} } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing endpoint parameter" },
        { status: 400 }
      );
    }

    let response;

    switch (endpoint) {
      case "meta":
        response = await buildMetaResponse();
        break;
      case "transfers":
        response = await buildTransfersResponse(params);
        break;
      case "holders":
        response = await buildHoldersResponse();
        break;
      case "defi":
        // DeFi activities require more complex parsing, return empty for now
        response = { success: true, data: [] };
        break;
      case "markets":
        response = await buildMarketsResponse();
        break;
      case "price-history":
        response = await buildPriceHistoryResponse();
        break;
      default:
        return NextResponse.json(
          { error: `Invalid endpoint: ${endpoint}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const response = await buildMetaResponse();
    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
