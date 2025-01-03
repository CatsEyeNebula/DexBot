import { BaseDexClient } from "../baseClient";
import BN from "bn.js";

import sol, { PublicKey } from "@solana/web3.js";
import {
    Raydium,
    TxVersion,
    ApiV3PoolInfoStandardItem,
    TxV0BuildData,
  } from "@raydium-io/raydium-sdk-v2";
import { SolanaPoolTracker } from "./solanaPoolTracker";



export class RaydiumClient extends BaseDexClient {
    
    address:string | undefined;
    poolTracker: SolanaPoolTracker
    
    constructor(address?: string) {
        super();
        this.address = address;
        this.poolTracker = new SolanaPoolTracker();
    }

    async getConnection(): Promise<sol.Connection> {
        const connection = new sol.Connection("url", "confirmed");
        return connection;
      }
    
    async getRaydiumClient(): Promise<Raydium> {
        const connection = await this.getConnection();
    
        let raydium: Raydium;
        if (this.address) {
          raydium = await Raydium.load({
            connection: connection,
            owner: new PublicKey(this.address),
            disableFeatureCheck: true,
            disableLoadToken: true,
            blockhashCommitment: "confirmed",
          });
        } else {
          raydium = await Raydium.load({
            connection: connection,
            disableFeatureCheck: true,
            disableLoadToken: true,
            blockhashCommitment: "confirmed",
          });
        }
        return raydium;
      }

      async snipe() : Promise<sol.VersionedTransaction>{
        const raydium = await this.getRaydiumClient();
        let swap : TxV0BuildData;

        let pool_info: ApiV3PoolInfoStandardItem = {} as ApiV3PoolInfoStandardItem;
        const pool = await this.poolTracker.waitingToGetPool();

        pool_info.id = pool.id;
        pool_info.programId = pool.programId;
        pool_info.mintA = pool.mintA;
        pool_info.mintB = pool.mintB;
        pool_info.pooltype = [];

        const computeBudgetConfig = {
            units: 5000000,
            microLamports: 1000000,
          };
      
        swap = await raydium.liquidity.swap({
            poolInfo: pool_info,
            poolKeys: pool,
            amountIn: new BN(amount_in),
            amountOut: new BN(amount_out),
            fixedSide: "in",
            inputMint: mintIn,
            txVersion: TxVersion.V0,
            computeBudgetConfig: computeBudgetConfig,
          });
          return 
      }

}