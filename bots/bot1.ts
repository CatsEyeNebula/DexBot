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
  const monitor = new RaydiumCreatePoolMonitor();
  const { pool_key_info, reverses } = await monitor.monitor();
  console.log(pool_key_info, reverses);
  const raydium = new RaydiumClient({
    owner_address: sender,
  });

  const params = {
    token_a: pool_key_info.mintB.address,
    token_b: "So11111111111111111111111111111111111111112",
    side: SIDE.BUY,
    amount: 1000,
    is_token_b_amount: false,
    slippage: 0.5,
    recipient_address: "2P93ZPcq6zxGbUyTYUqhSyY9qfJWCczEPt1EPEQM3nNZ",
  };

  const snipe_tx = await raydium.snipe(0.01);
  snipe_tx.sign([keypair]);

  const rawTransaction = snipe_tx.serialize();
  const conection = await raydium.getConnection();
  const hash = conection.sendRawTransaction(rawTransaction);
  console.log("snipe done ",hash);
  
};

if (require.main === module) {
    run();
}
