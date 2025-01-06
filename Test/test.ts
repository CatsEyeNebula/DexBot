import { SolanaPoolTracker } from "../dexClients/raydium/solanaPoolTracker";

const test = async () => {
  const client = new SolanaPoolTracker();
  await client.run();
};

if (require.main === module) {
  test();
}
