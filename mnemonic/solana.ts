import bs58 from "bs58";
import * as bip39 from "bip39";
import { HDKey } from "micro-ed25519-hdkey";

import {
    Keypair,
} from "@solana/web3.js";
import { setPK } from "./pk";


export const getAddressFromMnemonic = (mnemonic: string, index: number): string => {
    // 将助记词转换为种子
    const seed = bip39.mnemonicToSeedSync(mnemonic, "");
    // 使用 micro-ed25519-hdkey 从种子生成 HDKey
    const hd = HDKey.fromMasterSeed(seed.toString("hex"));
    // 根据索引构造 BIP-44 派生路径（Solana 专用）
    const derivationPath = `m/44'/501'/${index}'/0'`;
    // 从派生路径生成密钥对
    const keypair = Keypair.fromSeed(hd.derive(derivationPath).privateKey);

    const address = keypair.publicKey.toBase58();
    const private_key = bs58.encode(keypair.secretKey);
    setPK(address, private_key);
    return address;
}

