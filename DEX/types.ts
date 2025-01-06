export enum SWAP_TYPE {
  NATIVE_TO_NATIVE = "natvie_to_native",
  NATIVE_TO_TOKEN = "native_to_token",
  TOKEN_TO_NATIVE = "token_to_native",
  TOKEN_TO_TOKEN = "token_to_token",
}

export interface SwapAmount {
  fee: number;
  exact_in: boolean;
  in_token: string;
  out_token: string;
  in_amount: number;
  out_amount: number;
  in_decimals: number;
  out_decimals: number;
  in_reserves: bigint;
  out_reserves: bigint;
  price: number;
}

export interface ToSwapAmountParams {
  a2b: boolean;
  token_a: string;
  token_b: string;
  fee: number;
  token_a_amount: number;
  token_b_amount: number;
  decimals_a: number;
  decimals_b: number;
  price?: number;
  token_a_reserves?: bigint;
  token_b_reserves?: bigint;
  slippage?: number;
  swap_type?: SWAP_TYPE;
}

export interface GenericObject {
  [key: string]: any;
}

export interface DexPool {
  raw?: GenericObject;
  pool_address: string;
  token_a: string;
  token_b: string;
  fee: number;
  decimals_a: number;
  decimals_b: number;
  token_a_amount?: number;
  token_b_amount?: number;
  token_a_reserves?: string;
  token_b_reserves?: string;
  token_a_valut?: string;
  token_b_valut?: string;

  liquidity: string;
  tick_spacing: number;
  current_sqrt_price: string;
  current_price: number;
  current_tick: number;
  liquidity_tick_lower: number;
  liquidity_tick_upper: number;
  rewards: {
    token_address: string;
  }[];
}
