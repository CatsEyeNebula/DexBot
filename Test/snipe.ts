import { RaydiumCreatePoolMonitor } from "../dexClients/raydium/createPoolMonitor";
import { RaydiumClient } from "../dexClients/raydium/raydiumClient";
import { SIDE } from "../dexClients/raydium/types";

const snipeTx = async () => {
  const monitor = new RaydiumCreatePoolMonitor();
  const { pool_key_info, reverses } = await monitor.monitor();
  console.log(pool_key_info, reverses);

  const raydium = new RaydiumClient({
    owner_address: "7B91wLredmL6hgodVXNnMNoErnJ5KHNeEFKcofnCHVEv",
  });
  const params = {
    token_a: pool_key_info.mintB.address,
    token_b: "So11111111111111111111111111111111111111112",
    side: SIDE.BUY,
    amount: 1000,
    is_token_b_amount: false,
    slippage: 0.5,
    recipient_address: "2P93ZPcq6zxGbUyTYUqhSyY9qfJWCczEPt1EPEQM3nNZ",
    create_ata: true
  };
  const swap = await raydium.swap(params);
  console.log(swap);
};

if (require.main === module) {
  snipeTx();
}
