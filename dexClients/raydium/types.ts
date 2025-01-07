import BN from "bn.js";
import { CHAIN_ID } from "../../types";

export interface PoolKey {
  id: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  vault: {
    A: string;
    B: string;
  };
  programId: string;
  marketProgramId: string;
  marketId: string;
  mintA: {
    address: string;
    decimals: number;
  };
  mintB: {
    address: string;
    decimals: number;
  };
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketAuthority: string;
}

export interface PairSymbol {
  token_a: string;
  token_b: string;
  fee?: number;
  platforms?: string[];
  decimals_a?: number;
  decimals_b?: number;
  reserves_a?: number;
  reserves_b?: number;
  version?: number;
}

export enum SIDE {
  BUY = "buy",
  SELL = "sell",
}

export interface RoutePath {
  input_token: string;
  output_token: string;
  fee?: number;
}

export interface PoolAddress extends PairSymbol {
  address: string;
  publish_ts?: number;
}

export interface GetPriceParams extends PairSymbol {
  side?: SIDE;
  amount?: number;
  is_token_b_amount?: boolean; // default is false
  paths?: RoutePath[];
  pool_address?: PoolAddress;
}

export interface PoolAddress extends PairSymbol {
  address: string;
  publish_ts?: number;
}

export interface PoolInfo {
  id: string;
  programId: string;
  mintA: { address: string; decimals: number };
  mintB: { address: string; decimals: number };
  pooltype: string[];
}

export interface BuildSwapInstructionParams {
  token_in: string;
  token_out: string;
  amount_in: BN;
  amount_out: BN;
  recipient_address: string;
  pool_keys: PoolKey;
  pool_info: PoolInfo;
}

export enum SWAP_ROUTER {
  DEFAULT = "default",
  UNIVERSAL_ROUTER = "universal_router",
  CUSTOM_ROUTER = "custom_router",
}

export interface SwapParams extends PairSymbol {
  side: SIDE;
  amount: number;
  is_token_b_amount?: boolean; // default is false
  price?: number;
  recipient_address?: string;
  slippage?: number;
  order_duration?: number;
  router?: SWAP_ROUTER;
  permit2_nonce?: string;
  paths?: RoutePath[];
  pool_address?: PoolAddress;
  extra_params?: {
    nonce?: number;
    support_fee?: boolean;
    price_check?: boolean;
  };
}

export interface Reserves {
  [token_address: string]: number,
  timestamp?: number;
}

export interface ClientParams {
  chain_id?: CHAIN_ID;
  owner_address: string;
  private_key?: string;
  rpc?: string;
}
