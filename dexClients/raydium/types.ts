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
