// Solscan API Response Types for XAND Token

export const XAND_TOKEN_ADDRESS = "XANDuUoVoUqniKkpcKhrxmvYJybpJvUxJLr21Gaj3Hx";

// Token Metadata
export interface TokenMeta {
  address: string;
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  holder: number;
  creator: string;
  create_tx: string;
  created_time: number;
  first_mint_tx: string;
  first_mint_time: number;
  mint_authority: string | null;
  freeze_authority: string | null;
  supply: string;
  price: number;
  volume_24h: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_24h: number;
  price_change_6h?: number;
  price_change_1h?: number;
  liquidity?: number;
  fdv?: number;
  txns_24h?: { buys: number; sells: number };
  extensions: string[] | Record<string, unknown>;
  social_channels?: string[];
}

export interface TokenMetaResponse {
  success: boolean;
  data: TokenMeta;
}

// Token Transfer
export interface TokenTransfer {
  block_id: number;
  trans_id: string;
  block_time: number;
  time: string;
  activity_type: string;
  from_address: string;
  to_address: string;
  token_address: string;
  token_decimals: number;
  amount: number;
  flow: "in" | "out";
  value?: number;
}

export interface TokenTransferResponse {
  success: boolean;
  data: TokenTransfer[];
}

// Token Holder
export interface TokenHolder {
  address: string;
  amount: number;
  decimals: number;
  owner: string;
  rank: number;
  usd_value?: number;
  percentage?: number;
}

export interface TokenHoldersResponse {
  success: boolean;
  data: {
    total: number;
    items: TokenHolder[];
  };
}

// DeFi Activity Types
export type DefiActivityType =
  | "ACTIVITY_TOKEN_SWAP"
  | "ACTIVITY_AGG_TOKEN_SWAP"
  | "ACTIVITY_TOKEN_ADD_LIQ"
  | "ACTIVITY_TOKEN_REMOVE_LIQ"
  | "ACTIVITY_TOKEN_STAKE"
  | "ACTIVITY_TOKEN_UNSTAKE"
  | "ACTIVITY_TOKEN_HARVEST"
  | "ACTIVITY_TOKEN_VAULT_DEPOSIT"
  | "ACTIVITY_TOKEN_VAULT_WITHDRAW";

export interface DefiActivityToken {
  address: string;
  amount: number;
  decimals: number;
  token_address?: string;
}

export interface DefiActivity {
  block_id: number;
  trans_id: string;
  block_time: number;
  time: string;
  activity_type: DefiActivityType;
  from_address: string;
  to_address?: string;
  platform: string;
  sources: string[];
  tokens?: DefiActivityToken[];
  routers?: {
    token1: DefiActivityToken;
    token2: DefiActivityToken;
    child_routers?: unknown[];
  }[];
}

export interface DefiActivitiesResponse {
  success: boolean;
  data: DefiActivity[];
}

// Token Market/Pool
export interface TokenMarket {
  pool_id: string;
  program_id: string;
  token_1: string;
  token_2: string;
  token_account_1: string;
  token_account_2: string;
  trade_24h: number;
  trade_24h_change: number;
  volume_24h: number;
  volume_24h_quote: number;
  tvl?: number;
  trader_24h?: number;
}

export interface TokenMarketsResponse {
  success: boolean;
  data: TokenMarket[];
}

// API Request Types
export type SolscanEndpoint = "meta" | "transfers" | "holders" | "defi" | "markets";

export interface SolscanApiParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  activity_type?: string;
  from_time?: number;
  to_time?: number;
}

// Utility functions
export function formatTokenAmount(amount: number, decimals: number): string {
  const value = amount / Math.pow(10, decimals);
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}

export function formatUSD(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  }
  if (value >= 0.0001) {
    return `$${value.toFixed(6)}`;
  }
  if (value > 0) {
    return `$${value.toFixed(8)}`;
  }
  return `$0.00`;
}

export function formatPercentage(value: number): string {
  const formatted = value.toFixed(2);
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${formatted}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function getActivityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ACTIVITY_SPL_TRANSFER: "Transfer",
    ACTIVITY_SPL_BURN: "Burn",
    ACTIVITY_SPL_MINT: "Mint",
    ACTIVITY_SPL_CREATE_ACCOUNT: "Create Account",
    ACTIVITY_TOKEN_SWAP: "Swap",
    ACTIVITY_AGG_TOKEN_SWAP: "Aggregated Swap",
    ACTIVITY_TOKEN_ADD_LIQ: "Add Liquidity",
    ACTIVITY_TOKEN_REMOVE_LIQ: "Remove Liquidity",
    ACTIVITY_TOKEN_STAKE: "Stake",
    ACTIVITY_TOKEN_UNSTAKE: "Unstake",
    ACTIVITY_TOKEN_HARVEST: "Harvest",
    ACTIVITY_TOKEN_VAULT_DEPOSIT: "Vault Deposit",
    ACTIVITY_TOKEN_VAULT_WITHDRAW: "Vault Withdraw",
  };
  return labels[type] || type.replace("ACTIVITY_", "").replace(/_/g, " ");
}

export function getActivityTypeColor(type: string): string {
  if (type.includes("SWAP")) return "bg-blue-500/20 text-blue-400";
  if (type.includes("TRANSFER")) return "bg-green-500/20 text-green-400";
  if (type.includes("BURN")) return "bg-red-500/20 text-red-400";
  if (type.includes("MINT")) return "bg-purple-500/20 text-purple-400";
  if (type.includes("LIQ")) return "bg-yellow-500/20 text-yellow-400";
  if (type.includes("STAKE")) return "bg-orange-500/20 text-orange-400";
  return "bg-gray-500/20 text-gray-400";
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}
