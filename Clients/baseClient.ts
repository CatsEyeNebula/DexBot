import { CHAIN_ID } from "../types";
import { ClientParams } from "./raydium/types";

export class BaseDexClient {
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
  async snipe(amount_in: number): Promise<any> {}

  async sellAll() {}
}
