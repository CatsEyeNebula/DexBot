import { RaydiumCreatePoolMonitor } from "../dexClients/raydium/createPoolMonitor";
import { RaydiumClient } from "../dexClients/raydium/raydiumClient";
import { SIDE } from "../dexClients/raydium/types";
import { getPK } from "../mnemonic/pk";
import { getAddressFromMnemonic } from "../mnemonic/solana";
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  
  const sender = getAddressFromMnemonic(process.env.SOLANA_BOT,1);
  const privateKey = getPK(sender);
  const secretKey = bs58.decode(privateKey);  
  const keypair = Keypair.fromSecretKey(secretKey);
  console.log("address",keypair.publicKey.toBase58());
  const raydium = new RaydiumClient({
    owner_address: sender,
  });
  const conection = await raydium.getConnection();
  const monitor = new RaydiumCreatePoolMonitor();
  const { pool_key_info, reverses } = await monitor.monitor();
  console.log(pool_key_info, reverses);
  const snipe_tx = await raydium.snipe({amount_in: 0.001, pool_key: pool_key_info});
  snipe_tx.sign([keypair]);

  const rawTransaction = snipe_tx.serialize();
  const hash = await conection.sendRawTransaction(rawTransaction);
  console.log("snipe done ",hash);
  
  const sellAll_tx = await raydium.sellAll(pool_key_info);
  sellAll_tx.sign([keypair]);

  const sellRawTransaction = snipe_tx.serialize();
  const sellHash = await conection.sendRawTransaction(sellRawTransaction);
  console.log("sell done ",sellHash);

};

if (require.main === module) {
    run();
}
