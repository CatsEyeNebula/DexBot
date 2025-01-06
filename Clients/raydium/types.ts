import BN from "bn.js";

export interface PoolKey {
  id: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  vault: {
    A: string;
    B: string;
  };
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

export interface Reserves {
  [token_address: string]: number;
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
  mintA: {address: string; decimals: number};
  mintB: {address: string; decimals: number};
  pooltype: string[];
}

export interface BuildSwapInstructionParams {
  token_in: string;
  token_out: string;
  amount_in: BN;
  amount_out: BN;
  token_address: string;
  pool_keys: PoolKey;
  pool_info: PoolInfo;
}
