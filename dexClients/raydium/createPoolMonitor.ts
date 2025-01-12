import {
  Connection,
  PublicKey,
  ParsedMessageAccount,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { PoolKey, Reserves } from "./types";
import { RedisUtil } from "../../utils/redis";
import { MARKET_STATE_LAYOUT_V2 } from "@raydium-io/raydium-sdk-v2";

export const RAYDIUM_MIGRATION = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg";
export const RAYDIUM_LIQUIDITY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

export class RaydiumCreatePoolMonitor {
  rpc: string;
  connection: Connection;
  redis: RedisUtil;

  constructor() {
    this.rpc =
      "https://mainnet.helius-rpc.com/?api-key=3d02a593-0446-4e23-8237-cd47778f995e";
    this.connection = new Connection(this.rpc);
    this.redis = new RedisUtil({
      host: "localhost",
      port: "6379",
      db: 0,
    });
  }

  getAssociatedAuthority(programId: PublicKey, marketId: PublicKey) {
    const seeds = [marketId.toBuffer()];
    let nonce = 0;
    while (nonce < 100) {
      try {
        const seedsWithNonce = seeds.concat(
          Buffer.from([nonce]),
          Buffer.alloc(7)
        );
        const publicKey = PublicKey.createProgramAddressSync(
          seedsWithNonce,
          programId
        );
        return { publicKey, nonce };
      } catch (err) {
        nonce++;
      }
    }

    return { publicKey: PublicKey.default, nonce };
  }

  async monitor(): Promise<{ pool_key_info: PoolKey; reverses: Reserves }> {
    return new Promise((resolve, reject) => {
      let listenerId: number;
      listenerId = this.connection.onLogs(
        new PublicKey(RAYDIUM_MIGRATION),
        async ({ logs, err, signature }) => {
          if (err) {
            console.log(`[RAYDIUM] [monitor] error: `, err);
            reject(err);
            return;
          }
          console.log(`[RAYDIUM] [monitor] normal signature:`, signature);
          if (logs && logs.some((log) => log.includes("initialize2"))) {
            console.log(
              `[RAYDIUM] [monitor] initialize2 signature:`,
              signature
            );
            const parsed_tx = await this.parsedTargetSignature(signature);
            if (parsed_tx === null)
              throw new Error(`[RAYDIUM] [parsedTargetSignature] failed!`);
            const pool_key_info = await this.constructPoolInfo(parsed_tx);
            const reverses = this.fetchInitialReserves(
              parsed_tx,
              pool_key_info
            );

            const cache_key = `pool_key_info-${pool_key_info["id"]}`;
            await this.redis.set(cache_key, JSON.stringify(pool_key_info));

            const pair_cache_key = `pool_key_info-${pool_key_info["mintA"]["address"]}-${pool_key_info["mintB"]["address"]}`;
            await this.redis.set(pair_cache_key, JSON.stringify(pool_key_info));

            const pair_cache_key_reverse = `pool_key_info-${pool_key_info["mintB"]["address"]}-${pool_key_info["mintA"]["address"]}`;
            await this.redis.set(
              pair_cache_key_reverse,
              JSON.stringify(pool_key_info)
            );

            this.connection.removeOnLogsListener(listenerId);
            resolve({ pool_key_info, reverses });
          }
        }
      );
    });
  }

  async parsedTargetSignature(
    signature: string
  ): Promise<ParsedTransactionWithMeta | null> {
    const parsed_tx = this.connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    return parsed_tx;
  }

  async constructPoolInfo(
    parsed_tx: ParsedTransactionWithMeta
  ): Promise<PoolKey> {
    let pool_key_info = {} as PoolKey;
    let init_accounts: PublicKey[];
    let message_accounts: ParsedMessageAccount[];

    message_accounts = parsed_tx.transaction.message.accountKeys;
    parsed_tx.transaction.message.instructions.forEach((instruction) => {
      if (instruction.programId.toBase58() === RAYDIUM_LIQUIDITY) {
        if (!("accounts" in instruction)) {
          throw new Error(`[RAYDIUM] [instruction] don\`t have accounts!`);
        }
        init_accounts = instruction.accounts;
      }
    });

    const market_id = init_accounts[16];
    const marketProgramId = init_accounts[15];
    const marketAuthority = this.getAssociatedAuthority(
      marketProgramId,
      market_id
    ).publicKey;
    pool_key_info["id"] = init_accounts[4].toBase58();
    pool_key_info["authority"] = init_accounts[5].toBase58();
    pool_key_info["openOrders"] = init_accounts[6].toBase58();
    pool_key_info["targetOrders"] = init_accounts[12].toBase58();
    pool_key_info["vault"] = {
      A: init_accounts[10].toBase58(),
      B: init_accounts[11].toBase58(),
    };
    pool_key_info["marketProgramId"] = init_accounts[15].toBase58();
    pool_key_info["marketId"] = init_accounts[16].toBase58();
    pool_key_info["mintA"] = {
      address: init_accounts[8].toBase58(),
      decimals: 9,
    };
    pool_key_info["mintB"] = {
      address: init_accounts[9].toBase58(),
      decimals: 6,
    };
    pool_key_info["programId"] = RAYDIUM_LIQUIDITY;
    pool_key_info["marketBids"] = message_accounts[4].pubkey.toBase58();
    pool_key_info["marketAsks"] = message_accounts[5].pubkey.toBase58();
    pool_key_info["marketEventQueue"] = message_accounts[3].pubkey.toBase58();
    pool_key_info["marketBaseVault"] = message_accounts[6].pubkey.toBase58();
    pool_key_info["marketQuoteVault"] = message_accounts[7].pubkey.toBase58();
    pool_key_info["marketAuthority"] = marketAuthority.toBase58();
    return pool_key_info;
  }

  // async constructPoolInfo(parsed_tx: ParsedTransactionWithMeta): Promise<PoolKey> {
  //   let pool_key_info = {} as PoolKey;
  //   let init_accounts: PublicKey[];
  //   let message_accounts: ParsedMessageAccount[];

  //   message_accounts = parsed_tx.transaction.message.accountKeys;
  //   parsed_tx.transaction.message.instructions.forEach((instruction) => {
  //     if (instruction.programId.toBase58() === RAYDIUM_LIQUIDITY) {
  //       if (!("accounts" in instruction)) {
  //         throw new Error(`[RAYDIUM] [instruction] don\`t have accounts!`);
  //       }
  //       init_accounts = instruction.accounts;
  //     }
  //   });

  //   const market_id = init_accounts[16];
  //   const marketProgramId = init_accounts[15];
  //   const marketAuthority = this.getAssociatedAuthority(
  //     marketProgramId,
  //     market_id
  //   ).publicKey;
  //   const account_info = await this.connection.getAccountInfo(market_id);
  //   const market_info = MARKET_STATE_LAYOUT_V2.decode(account_info.data);
  //   pool_key_info["id"] = init_accounts[4].toBase58();
  //   pool_key_info["authority"] = init_accounts[5].toBase58();
  //   pool_key_info["openOrders"] = init_accounts[6].toBase58();
  //   pool_key_info["targetOrders"] = init_accounts[12].toBase58();
  //   pool_key_info["vault"] = {
  //     A: init_accounts[10].toBase58(),
  //     B: init_accounts[11].toBase58(),
  //   };
  //   pool_key_info["marketProgramId"] = init_accounts[15].toBase58();
  //   pool_key_info["marketId"] = init_accounts[16].toBase58();
  //   pool_key_info["mintA"] = {
  //     address: init_accounts[8].toBase58(),
  //     decimals: 9,
  //   };
  //   pool_key_info["mintB"] = {
  //     address: init_accounts[9].toBase58(),
  //     decimals: 6,
  //   };
  //   pool_key_info["programId"] = RAYDIUM_LIQUIDITY;
  //   pool_key_info["marketBids"] = market_info.bids.toBase58();
  //   pool_key_info["marketAsks"] = market_info.asks.toBase58();
  //   pool_key_info["marketEventQueue"] = market_info.eventQueue.toBase58();
  //   pool_key_info["marketBaseVault"] = market_info.baseVault.toBase58();
  //   pool_key_info["marketQuoteVault"] = market_info.quoteVault.toBase58();
  //   pool_key_info["marketAuthority"] = marketAuthority.toBase58();
  //   return pool_key_info;
  // }

  fetchInitialReserves(
    parsed_tx: ParsedTransactionWithMeta,
    pool_key_info: PoolKey
  ): Reserves {
    const meta = parsed_tx.meta;

    let reserves: Reserves = {};
    let postTokenBalances = meta.postTokenBalances;
    if (postTokenBalances[0].mint === pool_key_info["mintA"].address) {
      reserves[postTokenBalances[0].mint] =
        postTokenBalances[0].uiTokenAmount.uiAmount;
    }
    if (postTokenBalances[1].mint === pool_key_info["mintB"].address) {
      reserves[postTokenBalances[1].mint] =
        postTokenBalances[1].uiTokenAmount.uiAmount;
    }

    if (
      !reserves.hasOwnProperty(pool_key_info["mintA"].address) ||
      !reserves.hasOwnProperty(pool_key_info["mintB"].address)
    ) {
      throw new Error(`[RAYDIUM] [fetchInitialReserves] failed!`);
    }
    return reserves;
  }
}

const testMonitor = async () => {
  const monitor = new RaydiumCreatePoolMonitor();
  await monitor.monitor();
};

if (require.main === module) {
  testMonitor();
}
