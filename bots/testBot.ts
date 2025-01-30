import { RaydiumCreatePoolMonitor } from "../dexClients/raydium/createPoolMonitor";
import { RaydiumClient } from "../dexClients/raydium/raydiumClient";
import { FIXED_SIDE, PoolKey, SIDE } from "../dexClients/raydium/types";
import { getPK } from "../mnemonic/pk";
import { getAddressFromMnemonic } from "../mnemonic/solana";
// import { private_key } from "../jack_secret";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// 有一个主要的入口， 进程中只允许同时间最多存在10个bot， 然后一直循环进程 如果有bot消失了那么就新开一个bot
const run = async () => {
  // const sender = getAddressFromMnemonic(process.env.SOLANA_BOT, 1);
  // console.log(sender);
  // const private_key = getPK(sender);
  // const raydium = new RaydiumClient({
  //   owner_address: sender,
  // });
  // const conection = await raydium.getConnection();
  // const secretKey = bs58.decode(private_key);
  // const keypair = Keypair.fromSecretKey(secretKey);

  // console.log("address", keypair.publicKey.toBase58());

  // const monitor = new RaydiumCreatePoolMonitor();
  // const { pool_key_info, reverses } = await monitor.monitor();
  // console.log(pool_key_info, reverses);

  // const snipe_tx = await raydium.snipe({
  //   amount_in: 0.001,
  //   pool_key: pool_key_info,
  // });

  // snipe_tx.sign([keypair]);
  // const rawTransaction = snipe_tx.serialize();
  // const hash = await conection.sendRawTransaction(rawTransaction, {
  //   maxRetries: 3,
  //   skipPreflight: true,
  //   preflightCommitment: "confirmed",
  // });
  // console.log("snipe done ", hash);

  // const sell_tx = await raydium.sellAll(pool_key_info);
  // sell_tx.sign([keypair]);
  // const sell_rawTransaction = sell_tx.serialize();
  // const sell_hash = await conection.sendRawTransaction(sell_rawTransaction, {
  //   maxRetries: 3,
  //   skipPreflight: true,
  //   preflightCommitment: "confirmed",
  // });
  // console.log("sell done ", sell_hash);
  const index = parseInt(process.argv[2]); // 获取传递的 index

  console.log(`🚀${index}Bot ${process.pid} 启动`);

  // 假设有查询盈利的方法
  const PROFIT_TARGET = 0.002; // 目标盈利
  const TRADE_AMOUNT = 0.001; // 交易金额
  let profit = 0;
  while (profit < PROFIT_TARGET) {
    await new Promise((res) => setTimeout(res, 5000)); // 每5秒检查一次盈利
    profit += 0.001; // 模拟盈利增长（替换为真实逻辑）
  }

  console.log(`🎯 盈利达到目标: ${profit} SOL,执行Sell`);
    // 通知主进程 Bot 已盈利
    process.send?.({ type: "profitReached", pid: process.pid });

    // 退出进程
    process.exit();
};

if (require.main === module) {
  run();
}