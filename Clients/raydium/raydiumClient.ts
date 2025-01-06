import { BaseDexClient } from "../baseClient";
import BN from "bn.js";
import sol, { PublicKey } from "@solana/web3.js";
import {
  Raydium,
  TxVersion,
  ApiV3PoolInfoStandardItem,
  TxV0BuildData,
  PoolFetchType,
  AmmV4Keys,
  AmmV5Keys,
} from "@raydium-io/raydium-sdk-v2";
import { SolanaPoolTracker } from "./solanaPoolTracker";
import { SONALA_RPC } from "../../constants";
import { GetPriceParams, PairSymbol, PoolAddress, SIDE } from "./types";
import { calcAMMAmount } from "../../DEX/amm";
import { RedisUtil } from "../../Utils/redis";
import { DexPool } from "../../DEX/types";

export class RaydiumClient extends BaseDexClient {
  address: string | undefined;
  redis: RedisUtil;
  poolTracker: SolanaPoolTracker;
  native_token = "So11111111111111111111111111111111111111112";
  DEFAULT_FEE: number = 0.0025;

  constructor(address?: string) {
    super();
    this.address = address;
    this.poolTracker = new SolanaPoolTracker();
    this.redis = new RedisUtil({
      host: "localhost",
      port: "6379",
      db: 0,
    });
  }

  async getConnection(): Promise<sol.Connection> {
    const connection = new sol.Connection(SONALA_RPC, "confirmed");
    return connection;
  }

  async getRaydiumsdk(): Promise<Raydium> {
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

  async getPoolAddress(pair_symbol: PairSymbol): Promise<PoolAddress> {
    const raydium = await this.getRaydiumsdk();

    let pool_address: string;
    let feeRate: number;
    let pool_key_info;
    const { token_a, token_b } = pair_symbol;
    const pool_key_info_str = await this.redis.get(
      `pool_key_info-${token_a}-${token_b}`
    );
    const pool_key_info_str_reverse = await this.redis.get(
      `pool_key_info-${token_b}-${token_a}`
    );
    if (pool_key_info_str) {
      pool_key_info = JSON.parse(pool_key_info_str);
      pool_address = pool_key_info["id"];
    } else if (pool_key_info_str_reverse) {
      pool_key_info = JSON.parse(pool_key_info_str_reverse);
      pool_address = pool_key_info["id"];
    } else {
      let pool_info: ApiV3PoolInfoStandardItem;
      const cache_key = `pool_info-${token_a}-${token_b}`;
      const pool_info_str = await this.redis.get(cache_key);
      if (pool_info_str) {
        pool_info = JSON.parse(pool_info_str);
      } else {
        const pools_info = await raydium.api.fetchPoolByMints({
          mint1: token_a,
          mint2: token_b,
          type: PoolFetchType.Standard,
          sort: "liquidity",
          order: "desc",
        });
        pool_info = pools_info.data[0] as ApiV3PoolInfoStandardItem;
        if (pool_info) {
          await this.redis.set(cache_key, JSON.stringify(pool_info));
        } else {
          throw new Error(
            `fetchPoolByMints error. pools_info: ${JSON.stringify(pools_info)}`
          );
        }
      }
      pool_address = pool_info.id;
      feeRate = pool_info.feeRate;
    }

    return {
      token_a: token_a,
      token_b: token_b,
      fee: feeRate ? feeRate : this.DEFAULT_FEE,
      platforms: ["Raydium"],
      address: pool_address,
    };
  }

  async getPool(pool_address: string): Promise<DexPool> {
    const raydium = await this.getRaydiumsdk();
    const connection = await this.getConnection();

    let pool_key_info;
    const cache_key = `pool_key_info-${pool_address}`;
    const pool_key_info_str = await this.redis.get(cache_key);
    if (pool_key_info_str) {
      pool_key_info = JSON.parse(pool_key_info_str);
    } else {
      const pool_keys = await raydium.api.fetchPoolKeysById({
        idList: [pool_address],
      });
      pool_key_info = pool_keys[0] as AmmV4Keys | AmmV5Keys;
      if (pool_key_info) {
        await this.redis.set(cache_key, JSON.stringify(pool_key_info));
      } else {
        throw new Error(
          `fetchPoolKeysById error. pool_keys: ${JSON.stringify(pool_keys)}`
        );
      }
    }

    // get Reserves
    let reserves: { [token_address: string]: number; timestamp?: number } = {};
    const reserves_cache_key = `reserves-${pool_key_info["mintA"].address}-${pool_key_info["mintB"].address}`;
    const reserves_str = await this.redis.get(reserves_cache_key);
    if (reserves_str) {
      reserves = JSON.parse(reserves_str);
    } else {
      const result = await connection.getMultipleParsedAccounts([
        new PublicKey(pool_key_info.vault.A),
        new PublicKey(pool_key_info.vault.B),
      ]);
      result.value.forEach((value) => {
        if (value && "parsed" in value.data) {
          let info = value.data.parsed.info;
          console.log(info);
          reserves[info.mint] = info.tokenAmount.uiAmount;
        } else {
          throw new Error(
            `[RAYDIUM] [getPool] getMultipleParsedAccounts error!`
          );
        }
      });
      reserves.timestamp = Date.now();
      await this.redis.set(reserves_cache_key, JSON.stringify(reserves));
    }

    return {
      pool_address: pool_address,
      token_a: pool_key_info.mintA.address,
      token_b: pool_key_info.mintB.address,
      fee: this.DEFAULT_FEE, // @TODO
      decimals_a: pool_key_info.mintA.decimals,
      decimals_b: pool_key_info.mintB.decimals,
      token_a_reserves: String(reserves[pool_key_info.mintA.address]),
      token_b_reserves: String(reserves[pool_key_info.mintB.address]),
      token_a_valut: pool_key_info.vault.A,
      token_b_valut: pool_key_info.vault.B,
      liquidity: null,
      tick_spacing: null,
      current_sqrt_price: null,
      current_price: null,
      current_tick: null,
      liquidity_tick_lower: null,
      liquidity_tick_upper: null,
      rewards: null,
    };
  }

  async getPrice(params: GetPriceParams): Promise<number> {
    const pair: PairSymbol = {
      token_a: params.token_a,
      token_b: params.token_b,
    };
    const poolAddress = await this.getPoolAddress(pair);
    const pool = await this.getPool(poolAddress.address);

    let token_a = params.token_a;
    let token_b = params.token_b;
    let token_a_amount: number;
    let token_b_amount: number;
    let decimals_a: number;
    let decimals_b: number;
    let token_a_reserves: number;
    let token_b_reserves: number;
    const side = params.side || SIDE.BUY;
    const fee = Math.floor(pool.fee * 10000);

    if (token_a === pool.token_a) {
      [decimals_a, decimals_b] = [pool.decimals_a, pool.decimals_b];
      [token_a_reserves, token_b_reserves] = [
        Number(pool.token_a_reserves),
        Number(pool.token_b_reserves),
      ];
    } else {
      [decimals_a, decimals_b] = [pool.decimals_b, pool.decimals_a];
      [token_a_reserves, token_b_reserves] = [
        Number(pool.token_b_reserves),
        Number(pool.token_a_reserves),
      ];
    }

    if (params.is_token_b_amount) {
      token_b_amount = params.amount || 1;
      token_a_amount = 0;
    } else {
      token_a_amount = params.amount || 1;
      token_b_amount = 0;
    }

    if (token_b !== this.native_token) {
      throw new Error(`Quote Token ${token_b} should be native token.`);
    }

    const token_a_reserves_BI = BigInt(
      Math.ceil(token_a_reserves * Math.pow(10, decimals_a))
    );
    const token_b_reserves_BI = BigInt(
      Math.ceil(token_b_reserves * Math.pow(10, decimals_b))
    );
    const amm = calcAMMAmount({
      token_a,
      token_b,
      token_a_amount,
      token_b_amount,
      decimals_a: decimals_a,
      decimals_b: decimals_b,
      fee: fee,
      token_a_reserves: token_a_reserves_BI,
      token_b_reserves: token_b_reserves_BI,
      a2b: side !== SIDE.BUY,
    });
    const price = amm.price;
    return price;
  }

  // 没有给jito小费
  async snipe(amount_in: number): Promise<sol.VersionedTransaction> {
    const raydium = await this.getRaydiumsdk();
    let swap: TxV0BuildData;

    let pool_info: ApiV3PoolInfoStandardItem = {} as ApiV3PoolInfoStandardItem;
    const pool = await this.poolTracker.waitingToGetPool();

    pool_info.id = pool.id;
    pool_info.programId = pool.programId;
    pool_info.mintA = pool.mintA; //wsol
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
      amountOut: new BN(0),
      fixedSide: "in",
      inputMint: pool_info.mintB.address,
      txVersion: TxVersion.V0,
      computeBudgetConfig: computeBudgetConfig,
    });
    return swap.transaction;
  }

  async sellAll() {
    const raydium = await this.getRaydiumsdk();
    let swap: TxV0BuildData;

    let pool_info: ApiV3PoolInfoStandardItem = {} as ApiV3PoolInfoStandardItem;
    const pool = await this.poolTracker.waitingToGetPool();

    pool_info.id = pool.id;
    pool_info.programId = pool.programId;
    pool_info.mintA = pool.mintA; //wsol
    pool_info.mintB = pool.mintB;
    pool_info.pooltype = [];

    const computeBudgetConfig = {
      units: 5000000,
      microLamports: 1000000,
    };

    swap = await raydium.liquidity.swap({
      poolInfo: pool_info,
      poolKeys: pool,
      amountIn: new BN(0),
      amountOut: new BN(0),
      fixedSide: "out",
      inputMint: pool_info.mintA.address,
      txVersion: TxVersion.V0,
      computeBudgetConfig: computeBudgetConfig,
    });
    return;
  }
}
