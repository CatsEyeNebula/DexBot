import BN from "bn.js";
import sol, {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  Raydium,
  TxVersion,
  ApiV3PoolInfoStandardItem,
  TxV0BuildData,
  PoolFetchType,
  AmmV4Keys,
  AmmV5Keys,
  parseBigNumberish,
  generatePubKey,
  splAccountLayout,
  makeAMMSwapInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { SONALA_RPC } from "../../constants";
import {
  BuildSwapInstructionParams,
  ClientParams,
  GetPriceParams,
  PairSymbol,
  PoolAddress,
  PoolInfo,
  PoolKey,
  Reserves,
  SIDE,
  SwapParams,
} from "./types";
import { calcAMMAmount } from "../../amm/amm";
import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { RaydiumCreatePoolMonitor } from "./createPoolMonitor";
import { RedisUtil } from "../../utils/redis";
import { BaseDexClient } from "../baseClient";
import { SolanaPoolTracker } from "./solanaPoolTracker";
import { DexPool } from "../../amm/types";
import { toFixed } from "../../utils/format";
import axios from "axios";

export class RaydiumClient extends BaseDexClient {
  owner_address: string | undefined;
  redis: RedisUtil;
  poolTracker: SolanaPoolTracker;
  native_token = "So11111111111111111111111111111111111111112";
  DEFAULT_FEE: number = 0.0025;

  constructor(params: ClientParams) {
    super(params);
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
    if (this.owner_address) {
      raydium = await Raydium.load({
        connection: connection,
        owner: new PublicKey(this.owner_address),
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: "confirmed",
      });
    } else {
      throw new Error(`[RAYDIUM] [getRaydiumsdk] need owner_address!`);
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
    let reserves: Reserves = {};
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

  async buildSwapInstruction(
    params: BuildSwapInstructionParams
  ): Promise<sol.VersionedTransaction> {
    const raydium = await this.getRaydiumsdk();
    const connection = await this.getConnection();
    const owner = raydium.account.scope.ownerPubKey;
    const {
      token_in,
      token_out,
      amount_in,
      amount_out,
      pool_keys,
      pool_info,
      recipient_address,
    } = params;

    const modifyComputeUnits = sol.ComputeBudgetProgram.setComputeUnitLimit({
      units: 5000000,
    });
    const addPriorityFee = sol.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1000000,
    });
    const latestBlockhash = await connection.getLatestBlockhash();
    let initialTx = new sol.Transaction({
      recentBlockhash: latestBlockhash.blockhash,
      feePayer: owner,
    })
      .add(modifyComputeUnits)
      .add(addPriorityFee);

    let instructions: TransactionInstruction[] = [];
    let version = 4;
    if (pool_info.pooltype.includes("StablePool")) version = 5;

    const token_in_ata = await getAssociatedTokenAddress(
      new sol.PublicKey(token_in),
      owner,
      true
    );
    const token_out_ata = await getAssociatedTokenAddress(
      new sol.PublicKey(token_out),
      new sol.PublicKey(recipient_address),
      true
    );
    instructions.push(
      createAssociatedTokenAccountInstruction(
        owner,
        token_in_ata,
        owner,
        new sol.PublicKey(token_in)
      )
    );
    // const balanceNeeded = await connection.getMinimumBalanceForRentExemption(
    //   splAccountLayout.span,
    //   "confirmed",
    // );
    const balanceNeeded = 3123456;
    console.log(`balanceNeeded: ${balanceNeeded}`);
    const lamports = parseBigNumberish(amount_in).add(new BN(balanceNeeded));
    const newAccount = generatePubKey({
      fromPublicKey: owner,
      programId: TOKEN_PROGRAM_ID,
    });
    instructions.push(
      SystemProgram.createAccountWithSeed({
        fromPubkey: owner,
        basePubkey: owner,
        seed: newAccount.seed,
        newAccountPubkey: newAccount.publicKey,
        lamports: lamports.toNumber(),
        space: splAccountLayout.span,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    instructions.push(
      createInitializeAccountInstruction(
        newAccount.publicKey,
        new sol.PublicKey(token_in),
        owner
      )
    );
    instructions.push(
      createTransferInstruction(
        newAccount.publicKey,
        token_in_ata,
        owner,
        BigInt(String(amount_in))
      )
    );
    instructions.push(
      createAssociatedTokenAccountInstruction(
        owner,
        token_out_ata,
        new sol.PublicKey(recipient_address),
        new sol.PublicKey(token_out)
      )
    );
    instructions.push(
      makeAMMSwapInstruction({
        version,
        poolKeys: pool_keys as any,
        userKeys: {
          tokenAccountIn: token_in_ata!,
          tokenAccountOut: token_out_ata!,
          owner: owner,
        },
        amountIn: amount_in,
        amountOut: amount_out,
        fixedSide: "in",
      })
    );
    instructions.push(
      createCloseAccountInstruction(
        newAccount.publicKey,
        owner,
        owner,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    instructions.push(
      createCloseAccountInstruction(
        token_in_ata,
        owner,
        owner,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    instructions.forEach((instruction) => {
      initialTx.add(instruction);
    });
    const messageV0 = new sol.TransactionMessage({
      payerKey: new sol.PublicKey(this.owner_address),
      recentBlockhash: latestBlockhash.blockhash,
      instructions: initialTx.instructions,
    }).compileToV0Message();
    const versionedTransaction = new sol.VersionedTransaction(messageV0);
    return versionedTransaction;
  }

  // async swap(params: SwapParams): Promise<sol.VersionedTransaction> {
  //   if (!this.owner_address) {
  //     throw new Error(`[RAYDIUM] [swap] require address!`);
  //   }
  //   const raydium = await this.getRaydiumsdk();
  //   const owner = raydium.account.scope.ownerPubKey;
  //   let { token_a, token_b } = params;

  //   const pair: PairSymbol = {
  //     token_a: token_a,
  //     token_b: token_b,
  //   };
  //   const poolAddress = await this.getPoolAddress(pair);
  //   const pool = await this.getPool(poolAddress.address);

  //   let token_a_amount: number;
  //   let token_b_amount: number;
  //   let side = params.side;
  //   let price = params.price || (await this.getPrice(params));
  //   const slippage = params.slippage || 0.01;

  //   if (!params.amount) {
  //     throw new Error(`Amount is required!`);
  //   }

  //   if (params.is_token_b_amount) {
  //     token_b_amount = params.amount;
  //     token_a_amount = 0;
  //   } else {
  //     token_a_amount = params.amount;
  //     token_b_amount = 0;
  //   }

  //   if (token_a !== pool.token_a) {
  //     [token_a, token_b] = [token_b, token_a];
  //     [token_a_amount, token_b_amount] = [token_b_amount, token_a_amount];
  //     side = side === SIDE.BUY ? SIDE.SELL : SIDE.BUY;
  //     price = 1 / price;
  //   }

  //   // pool_key_info
  //   const cache_key = `pool_key_info-${poolAddress.address}`;
  //   const pool_key_info_str = await this.redis.get(cache_key);
  //   const pool_key_info = JSON.parse(pool_key_info_str);

  //   // pool_info
  //   let pool_info = {} as ApiV3PoolInfoStandardItem;
  //   pool_info.id = pool_key_info.id;
  //   pool_info.programId = pool_key_info.programId;
  //   pool_info.mintA = pool_key_info.mintA;
  //   pool_info.mintB = pool_key_info.mintB;
  //   pool_info.pooltype = [];

  //   const recipient_address = params.recipient_address
  //     ? params.recipient_address
  //     : owner.toBase58();

  //   const mintIn =
  //     side === SIDE.BUY ? pool_info.mintB.address : pool_info.mintA.address;
  //   const mintOut =
  //     side === SIDE.BUY ? pool_info.mintA.address : pool_info.mintB.address;
  //   const decimals_in =
  //     side === SIDE.BUY ? pool_info.mintB.decimals : pool_info.mintA.decimals;
  //   const decimals_out =
  //     side === SIDE.BUY ? pool_info.mintA.decimals : pool_info.mintB.decimals;
  //   let amount_in = side === SIDE.BUY ? token_b_amount : token_a_amount;
  //   let amount_out = side === SIDE.BUY ? token_a_amount : token_b_amount;

  //   if (side === SIDE.SELL) {
  //     price = 1 / price;
  //   }

  //   if (amount_in) {
  //     amount_out = (amount_in / price) * (1 - slippage);
  //   } else {
  //     amount_in = amount_out * price * (1 + slippage);
  //   }

  //   console.log(`amount_out: ${amount_out}, amount_in: ${amount_in}`);

  //   amount_in = Math.floor(amount_in * Math.pow(10, decimals_in));
  //   amount_out = Math.floor(amount_out * Math.pow(10, decimals_out));

  //   console.log(`amount_out: ${amount_out}, amount_in: ${amount_in}`);

  //   const version_tx = await this.buildSwapInstruction({
  //     token_in: mintIn,
  //     token_out: mintOut,
  //     amount_in: new BN(amount_in),
  //     amount_out: new BN(amount_out),
  //     recipient_address: recipient_address,
  //     pool_info: pool_info,
  //     pool_keys: pool_key_info,
  //   });
  //   return version_tx;
  // }

  async swap(params: SwapParams): Promise<sol.VersionedTransaction> {
    if (!this.owner_address) {
      throw new Error(`[RAYDIUM] [swap] require owner_address!`);
    }
    const raydium = await this.getRaydiumsdk();
    const owner = raydium.account.scope.ownerPubKey;

    let { token_a, token_b, create_ata } = params;

    const pair: PairSymbol = {
      token_a: token_a,
      token_b: token_b,
    };
    const poolAddress = await this.getPoolAddress(pair);
    const pool = await this.getPool(poolAddress.address);

    let token_a_amount: number;
    let token_b_amount: number;
    let side = params.side;
    let price = params.price || (await this.getPrice(params));
    const slippage = params.slippage || 0.01;

    if (!params.amount) {
      throw new Error(`Amount is required!`);
    }

    if (params.is_token_b_amount) {
      token_b_amount = params.amount;
      token_a_amount = 0;
    } else {
      token_a_amount = params.amount;
      token_b_amount = 0;
    }

    if (token_a !== pool.token_a) {
      [token_a, token_b] = [token_b, token_a];
      [token_a_amount, token_b_amount] = [token_b_amount, token_a_amount];
      side = side === SIDE.BUY ? SIDE.SELL : SIDE.BUY;
      price = 1 / price;
    }

    // pool_key_info
    const cache_key = `pool_key_info-${poolAddress.address}`;
    const pool_key_info_str = await this.redis.get(cache_key);
    const pool_key_info = JSON.parse(pool_key_info_str);

    // pool_info
    let pool_info = {} as ApiV3PoolInfoStandardItem;
    pool_info.id = pool_key_info.id;
    pool_info.programId = pool_key_info.programId;
    pool_info.mintA = pool_key_info.mintA;
    pool_info.mintB = pool_key_info.mintB;
    pool_info.pooltype = [];

    const recipient_address = params.recipient_address
      ? params.recipient_address
      : owner.toBase58();

    const mintIn = //wsol
      side === SIDE.BUY ? pool_info.mintB.address : pool_info.mintA.address;
    const mintOut = //token 
      side === SIDE.BUY ? pool_info.mintA.address : pool_info.mintB.address;
    const decimals_in =
      side === SIDE.BUY ? pool_info.mintB.decimals : pool_info.mintA.decimals;
    const decimals_out =
      side === SIDE.BUY ? pool_info.mintA.decimals : pool_info.mintB.decimals;
    let amount_in = side === SIDE.BUY ? token_b_amount : token_a_amount;
    let amount_out = side === SIDE.BUY ? token_a_amount : token_b_amount;

    if (side === SIDE.SELL) {
      price = 1 / price;
    }

    if (amount_in) {
      amount_out = (amount_in / price) * (1 - slippage);
    } else {
      amount_in = amount_out * price * (1 + slippage);
    }

    amount_in = Math.floor(amount_in * Math.pow(10, decimals_in));
    amount_out = Math.floor(amount_out * Math.pow(10, decimals_out));

    const version_tx = await this.buildSwapInstruction({
      token_in: mintIn,
      token_out: mintOut,
      amount_in: new BN(amount_in),
      amount_out: new BN(amount_out),
      recipient_address: recipient_address,
      pool_info: pool_info,
      pool_keys: pool_key_info,
      create_ata: create_ata
    });

    return version_tx;
  }

  async snipe(params: {
    amount_in: number;
    pool_key: PoolKey;
  }): Promise<sol.VersionedTransaction> {
    const raydium = await this.getRaydiumsdk();
    const { amount_in, pool_key } = params;

    let pool_info = {} as PoolInfo;
    pool_info.id = pool_key.id;
    pool_info.programId = pool_key.programId;
    pool_info.mintA = pool_key.mintA;
    pool_info.mintB = pool_key.mintB;
    pool_info.pooltype = [];

    const amount_in_bg = Math.floor(
      amount_in * Math.pow(10, pool_info.mintA.decimals)
    );

    const token_in = pool_info.mintA.address;
    const token_out = pool_info.mintB.address;
    const owner = raydium.account.scope.ownerPubKey;

    const version_tx = await this.buildSwapInstruction({
      token_in: token_in,
      token_out: token_out,
      amount_in: new BN(amount_in_bg),
      amount_out: new BN(0),
      recipient_address: owner.toBase58(),
      pool_info: pool_info,
      pool_keys: pool_key,
      create_ata: true
    });

    return version_tx;
  }

  async sellAll(pool_key: PoolKey) {
    const raydium = await this.getRaydiumsdk();
    let pool_info = {} as PoolInfo;
    pool_info.id = pool_key.id;
    pool_info.programId = pool_key.programId;
    pool_info.mintA = pool_key.mintA;
    pool_info.mintB = pool_key.mintB;
    pool_info.pooltype = [];

    const sell_balance = await this.getTokenBalance(
      this.owner_address,
      pool_info.mintB.address
    );

    const amount_in = Math.floor(
      sell_balance * Math.pow(10, pool_info.mintB.decimals)
    );

    const token_in = pool_info.mintB.address;
    const token_out = pool_info.mintA.address;
    const owner = raydium.account.scope.ownerPubKey;

    const version_tx = await this.buildSwapInstruction({
      token_in: token_in,
      token_out: token_out,
      amount_in: new BN(amount_in),
      amount_out: new BN(0),
      recipient_address: owner.toBase58(),
      pool_info: pool_info,
      pool_keys: pool_key,
      create_ata: false
    });

    return version_tx;
  }

  async getBalance(address?: string): Promise<number> {
    address = address || this.owner_address;
    const connection = await this.getConnection();
    const balance_raw = await connection.getBalance(new sol.PublicKey(address));
    const balance = balance_raw / 10 ** 9;
    return balance;
  }

  async getTokenBalance(
    token_address: string,
    address?: string
  ): Promise<number> {
    address = address || this.owner_address;
    let bal: number;
    if (this.isNative(token_address) || token_address === this.native_token) {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [
          address,
          {
            encoding: "jsonParsed",
            commitment: "confirmed",
          },
        ],
      };
      const resp = await axios.post(
        "https://mainnet.helius-rpc.com/?api-key=3d02a593-0446-4e23-8237-cd47778f995e",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      bal = resp.data.result.value / Math.pow(10, 9);
    } else {
      const token_account = await getAssociatedTokenAddress(
        new sol.PublicKey(token_address),
        new sol.PublicKey(address),
        true
      );
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountBalance",
        params: [
          token_account,
          {
            commitment: "confirmed",
          },
        ],
      };
      const resp = await axios.post(
        "https://mainnet.helius-rpc.com/?api-key=3d02a593-0446-4e23-8237-cd47778f995e",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!resp.data?.result) {
        if (resp.data.error.message.includes("could not find account")) {
          bal = 0;
        } else {
          throw Error(resp.data.error);
        }
      } else {
        bal =
          Number(resp.data.result.value.amount) /
          Math.pow(10, resp.data.result.value.decimals);
      }
    }

    return bal;
  }

  isNative(address: string) {
    if (address === NATIVE_MINT.toBase58()) {
      return true;
    } else {
      return false;
    }
  }
}
