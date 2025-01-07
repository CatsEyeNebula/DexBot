import WebSocket from "ws";
import axios from "axios";
import { Connection, PublicKey, ParsedMessageAccount } from "@solana/web3.js";


//pm2 start 'npx ts-node poolTracker.ts' --name solana_pool_tracker --attach

const LAMPORTS_PER_SOL = 10 ** 9;
const WEBSOCKET_URL = `wss://mainnet.helius-rpc.com/?api-key=3d02a593-0446-4e23-8237-cd47778f995e`;
const LIMIT_SOL_THRESHOLD = 70; // 50 SOL
const PUMO_MIGRATION_ADDRESS = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"

export class SolanaPoolTracker {
    previousLamports: number;
    rpc: string;

    constructor() {
        this.rpc = "https://mainnet.helius-rpc.com/?api-key=3d02a593-0446-4e23-8237-cd47778f995e";
    }

    findTargetTransactions(transactions: any) {
        const slotMap = new Map();
        transactions.forEach((tx: any) => {
            const slot = tx.slot;
            if (!slotMap.has(slot)) {
                slotMap.set(slot, []);
            }
            slotMap.get(slot).push(tx);
        });

        const targetTransactions: any[] = [];
        slotMap.forEach((txs) => {
            if (txs.length === 3) {
                targetTransactions.push(...txs);
            }
        });
        return targetTransactions;
    }

    async fetchSignatures() {
        try {
            const response = await axios.post(
                this.rpc,
                {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getSignaturesForAddress",
                    params: [
                        PUMO_MIGRATION_ADDRESS,
                        { "limit": 9 }
                    ],
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            const signatures = response.data.result;
            const targetTransactions = this.findTargetTransactions(signatures);
            await this.processTargetTransactions(targetTransactions);
            return;
        } catch (error) {
            // logger.error("Error fetching Signatures:", error);
        }
    }

    async getPool() {
        try {
            const response = await axios.post(
                this.rpc,
                {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getSignaturesForAddress",
                    params: [
                        PUMO_MIGRATION_ADDRESS,
                        { "limit": 9 }
                    ],
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            const signatures = response.data.result;
            const targetTransactions = this.findTargetTransactions(signatures);
            return await this.processPoolInfo(targetTransactions);
        } catch (error) {
            // logger.error("Error fetching Signatures:", error);
        }
    }

    async processTargetTransactions(targetTransactions: any[]) {
        let initTx: ParsedMessageAccount[];
        let createAccountWithSeedTx: ParsedMessageAccount[];
        const signatures: string[] = targetTransactions.map(transaction => transaction.signature);
        const datas = await this.fetchTransactionDetails(signatures);
        console.log(signatures);

        for (const data of datas) {
            if (data.transaction.message.instructions[0]['parsed']['type'] !== 'transfer') {
                if (data.transaction.message.instructions[1]['parsed']['type'] === "initializeAccount") {
                    initTx = data.transaction.message.accountKeys;
                } else {
                    createAccountWithSeedTx = data.transaction.message.accountKeys;
                }
            }
        }
        const poolAddress = initTx[2].pubkey;
        const poolInfo = this.constructPoolInfo(initTx, createAccountWithSeedTx);
        console.log(poolInfo);
        const poolInfoKey = `pool_key_info${poolAddress}`;
        return poolInfo;
    }

    async processPoolInfo(targetTransactions: any[]) {
        let initTx: ParsedMessageAccount[];
        let createAccountWithSeedTx: ParsedMessageAccount[];
        const signatures: string[] = targetTransactions.map(transaction => transaction.signature);
        const datas = await this.fetchTransactionDetails(signatures);
        console.log(signatures);

        for (const data of datas) {
            if (data.transaction.message.instructions[0]['parsed']['type'] !== 'transfer') {
                if (data.transaction.message.instructions[1]['parsed']['type'] === "initializeAccount") {
                    initTx = data.transaction.message.accountKeys;
                } else {
                    createAccountWithSeedTx = data.transaction.message.accountKeys;
                }
            }
        }
        const poolInfo = this.constructPoolInfo(initTx, createAccountWithSeedTx);
        return poolInfo;
    }

    constructPoolInfo(initTx: ParsedMessageAccount[], createAccountWithSeedTx: ParsedMessageAccount[]) {
        return {
            "programId": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
            "id": initTx[2].pubkey,
            "mintA": {
                "chainId": 101,
                "address": "So11111111111111111111111111111111111111112",
                "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                "logoURI": "https://img-v1.raydium.io/icon/So11111111111111111111111111111111111111112.png",
                "symbol": "WSOL",
                "name": "Wrapped SOL",
                "decimals": 9,
            },
            "mintB": {
                "chainId": 101,
                "address": initTx[18].pubkey,
                "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                "symbol": "",
                "name": "",
                "decimals": 6,
            },
            "vault": {
                "A": initTx[5].pubkey,
                "B": initTx[6].pubkey,
            },
            "authority": initTx[17].pubkey,
            "openOrders": initTx[3].pubkey,
            "targetOrders": initTx[7].pubkey,
            "marketProgramId": initTx[20].pubkey,
            "marketId": initTx[21].pubkey,
            "marketAuthority": this.getAssociatedAuthority(initTx[20].pubkey, initTx[21].pubkey).publicKey.toBase58(),
            "marketBaseVault": createAccountWithSeedTx[6].pubkey,
            "marketQuoteVault": createAccountWithSeedTx[7].pubkey,
            "marketBids": createAccountWithSeedTx[4].pubkey,
            "marketAsks": createAccountWithSeedTx[5].pubkey,
            "marketEventQueue": createAccountWithSeedTx[3].pubkey,
        };
    }

    getAssociatedAuthority(programId: PublicKey, marketId: PublicKey) {
        const seeds = [marketId.toBuffer()];
        let nonce = 0;
        while (nonce < 100) {
            try {
                const seedsWithNonce = seeds.concat(Buffer.from([nonce]), Buffer.alloc(7));
                const publicKey = PublicKey.createProgramAddressSync(seedsWithNonce, programId);
                return { publicKey, nonce };
            } catch (err) {
                nonce++;
            }
        }

        return { publicKey: PublicKey.default, nonce };
    }

    async fetchTransactionDetails(signatures: string[]) {
        const connection = new Connection(this.rpc);
        try {
            const res = await connection.getParsedTransactions(signatures, { maxSupportedTransactionVersion: 0 });
            return res;
        } catch (error) {
            // logger.error(`Error fetching details for transaction ${signatures}:`, error);
            return null;
        }
    }

    doTrack() {
        const ws = new WebSocket(WEBSOCKET_URL);

        ws.on("open", () => {
            console.log("Connected to WebSocket.");

            const request = {
                jsonrpc: "2.0",
                method: "accountSubscribe",
                id: 1,
                params: [
                    PUMO_MIGRATION_ADDRESS,
                    {
                        encoding: "jsonParsed",
                        commitment: "finalized",
                    },
                ],
            };
            ws.send(JSON.stringify(request));
        });

        ws.on("message", (data) => {
            try {
                const response = JSON.parse(data.toString());
                const currentLamports = response.params?.result?.value?.lamports;

                if (typeof currentLamports === "number") {
                    console.log("Current Lamports:", currentLamports);

                    if (this.previousLamports !== null) {
                        const lamportsChange = Math.abs(currentLamports - this.previousLamports);
                        const solChange = lamportsChange / LAMPORTS_PER_SOL;

                        console.log(`Change in SOL: ${solChange} SOL`);

                        if (solChange > LIMIT_SOL_THRESHOLD) {
                            console.log(`ALERT: Lamports changed by ${solChange.toFixed(9)} SOL, exceeding threshold.`);
                            this.fetchSignatures();
                        }
                    }

                    this.previousLamports = currentLamports;
                }
            } catch (error) {
                console.log("Error processing message:", error);
            }
        });

        ws.on("error", (error) => {
            console.log("WebSocket error:", error);
        });

        ws.on("close", () => {
            console.log("WebSocket connection closed.");
        });
    }

    async waitingToGetPool() : Promise<any>{
        return new Promise((resolve, reject) => { 
            const ws = new WebSocket(WEBSOCKET_URL);
    
            ws.on("open", () => {
                console.log("Connected to WebSocket.");
    
                const request = {
                    jsonrpc: "2.0",
                    method: "accountSubscribe",
                    id: 1,
                    params: [
                        PUMO_MIGRATION_ADDRESS,
                        {
                            encoding: "jsonParsed",
                            commitment: "finalized",
                        },
                    ],
                };
                ws.send(JSON.stringify(request));
            });
    
            ws.on("message", async (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    const currentLamports = response.params?.result?.value?.lamports;
    
                    if (typeof currentLamports === "number") {
                        console.log("Current Lamports:", currentLamports);
    
                        if (this.previousLamports !== null) {
                            const lamportsChange = Math.abs(currentLamports - this.previousLamports);
                            const solChange = lamportsChange / LAMPORTS_PER_SOL;
    
                            console.log(`Change in SOL: ${solChange} SOL`);
    
                            if (solChange > LIMIT_SOL_THRESHOLD) {
                                console.log(`ALERT: Lamports changed by ${solChange.toFixed(9)} SOL, exceeding threshold.`);
    
                                try {
                                    const poolData = await this.getPool();
                                    ws.close();
                                    resolve(poolData);
                                    console.log(poolData);
                                } catch (error) {
                                    ws.close(); 
                                    reject(error); 
                                }
                            }
                        }
    
                        this.previousLamports = currentLamports;
                    }
                } catch (error) {
                    console.log("Error processing message:", error);
                    ws.close();
                    reject(error); // Reject the Promise on error
                }
            });
    
            ws.on("error", (error) => {
                console.log("WebSocket error:", error);
                ws.close();
                reject(error); // Reject the Promise on WebSocket error
            });
    
            ws.on("close", () => {
                console.log("WebSocket connection closed.");
            });
        });
    }
    
    run() {
        this.doTrack();
    }
}

