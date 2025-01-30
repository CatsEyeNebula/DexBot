import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    Keypair,
  } from "@solana/web3.js";

import bs58 from "bs58";
import dotenv from "dotenv";
import path from "path";
import { getAddressFromMnemonic } from "../mnemonic/solana";
import { getPK } from "../mnemonic/pk";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const run = async () => {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=3d02a593-0446-4e23-8237-cd47778f995e");
    const private_key = "2uAstoPVJ6KcAfyqKZbEAbz1XK6FcifVSzz8xyBhfu4XdcJEMsLbdipxvkY2NnrfjF2npwgw4T8E6N9RDpLyb7Hw"
    const receiver = getAddressFromMnemonic(process.env.SOLANA_BOT, 1);
    const receiverPrivatekey = getPK(receiver);
    const receiverSecretKey = bs58.decode(receiverPrivatekey);
    const reserverKeyPair = Keypair.fromSecretKey(receiverSecretKey);
    const secretKey = bs58.decode(private_key);
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log("address", keypair.publicKey.toBase58());


    const nonceAccountInfo = await connection.getAccountInfo(keypair.publicKey);
    if (!nonceAccountInfo) {
      throw new Error("Nonce account not found");
    }
    // const nonce = nonceAccountInfo.fromAccountData(nonceAccountInfo.data);


    console.log("nonceAccountInfo",nonceAccountInfo);
    
    const withdrawInstruction = SystemProgram.nonceWithdraw({
      noncePubkey: keypair.publicKey,
      authorizedPubkey: keypair.publicKey,
      toPubkey: reserverKeyPair.publicKey,
      lamports:nonceAccountInfo.lamports - 1452680
      ,
    });

    const transaction = new Transaction().add(withdrawInstruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

      // Sign the transaction
  transaction.sign(keypair);

  // Send the transaction to the cluster
  const txId = await connection.sendRawTransaction(transaction.serialize());

  await connection.confirmTransaction(txId, "finalized");

    console.log(
        "hash",txId
    );
    
};

if (require.main === module) {
    run();
}
