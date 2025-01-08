import { CHAIN_ID } from "../types";
import { ClientParams } from "./raydium/types";
import { PoolKey } from "./raydium/types";
import sol from "@solana/web3.js";

 export abstract class BaseDexClient {
  chain_id: CHAIN_ID;
  owner_address?: string;
  private_key?: string;
  rpc?: string;

  constructor(params: ClientParams) {
    if (params) {
      this.chain_id = this.chain_id ?? params.chain_id;
      this.owner_address = params.owner_address;
      this.private_key = params.private_key;
      this.rpc = params.rpc;
    }
  }

  abstract snipe({
    amount_in,
    pool_key,
  }): Promise<sol.VersionedTransaction>;

  abstract sellAll(sellToken) : Promise<sol.VersionedTransaction>;
}
