import { RaydiumCreatePoolMonitor } from "../dexClients/raydium/createPoolMonitor";
import { RaydiumClient } from "../dexClients/raydium/raydiumClient";
import { SIDE } from "../dexClients/raydium/types";
import { getPK } from "../mnemonic/pk";
import { getAddressFromMnemonic } from "../mnemonic/solana";
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const run = async () => {
  const monitor = new RaydiumCreatePoolMonitor();
  const { pool_key_info, reverses } = await monitor.monitor();
  console.log(pool_key_info, reverses);
  const sender = getAddressFromMnemonic(process.env.SOLANA_BOT,1);
  const raydium = new RaydiumClient({
    owner_address: sender,
  });

  const privateKey = getPK(sender);
  const secretKey = bs58.decode(privateKey);
  const keypair = Keypair.fromSecretKey(secretKey);

  const snipe_tx = await raydium.snipe({amount_in: 0.01, pool_key: pool_key_info});
  snipe_tx.sign([keypair]);

  const rawTransaction = snipe_tx.serialize();
  const conection = await raydium.getConnection();
  const hash = conection.sendRawTransaction(rawTransaction);
  console.log("snipe done ",hash);
  
};

if (require.main === module) {
    run();
}
