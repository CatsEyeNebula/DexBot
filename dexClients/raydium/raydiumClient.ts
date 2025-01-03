import { BaseDexClient } from "../baseClient";
import BN from "bn.js";

import sol, { PublicKey } from "@solana/web3.js";
import {
    toToken,
    Raydium,
    Percent,
    TxVersion,
    PoolUtils,
    TickUtils,
    TokenAmount,
    PoolFetchType,
    PositionUtils,
    CLMM_PROGRAM_ID,
    TickArrayLayout,
    PositionInfoLayout,
    ApiV3PoolInfoStandardItem,
    ApiV3PoolInfoConcentratedItem,
    getPdaPersonalPositionAddress,
    TxV0BuildData,
    ApiV3PoolInfoItem,
    PoolKeys,
    AmmRpcData,
    AmmV4Keys,
    AmmV5Keys,
  } from "@raydium-io/raydium-sdk-v2";



export class RaydiumClient extends BaseDexClient {
    
    address:string | undefined;
    
    constructor(address?: string) {
        super();
        this.address = address;
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

        swap = await raydium.liquidity.swap({
            poolInfo: pool_info,
            poolKeys: pool_key_info,
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