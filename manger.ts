import { fork, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

const MAX_BOTS_PER_STRATEGY = 10;
const bots: Map<number, { process: ChildProcess; index: number, strategy: string }> = new Map();
const indexFilePath = path.resolve(__dirname, "index.json");

interface BotMessage {
    type: "profitReached";
    pid: number;
}

// 读取索引文件
const readIndexFile = (): Record<string, number[]> => {
    if (!fs.existsSync(indexFilePath)) {
        fs.writeFileSync(indexFilePath, JSON.stringify({}));
    }
    const data = fs.readFileSync(indexFilePath, "utf-8");
    return JSON.parse(data);
};

// 写入索引文件
const writeIndexFile = (data: Record<string, number[]>) => {
    fs.writeFileSync(indexFilePath, JSON.stringify(data, null, 2));
};

const getAvailableIndex = (strategy: string): number => {
    const indexData = readIndexFile();
    if (!indexData[strategy]) {
        indexData[strategy] = [];
    }

    // 确保不同策略使用不同的 index 段
    const strategyIndex = Object.keys(indexData).indexOf(strategy);
    const baseIndex = strategyIndex * MAX_BOTS_PER_STRATEGY; // 该策略的起始索引范围
    const maxIndex = baseIndex + MAX_BOTS_PER_STRATEGY;

    const usedIndices = new Set(indexData[strategy]);

    // 找到当前策略段内最小的可用 index
    for (let i = baseIndex; i < maxIndex; i++) {
        if (!usedIndices.has(i)) {
            indexData[strategy].push(i);
            writeIndexFile(indexData);
            console.log(`[${strategy}] 分配索引: ${i}`);
            return i;
        }
    }
    throw new Error(`No available index for strategy ${strategy}`);
};


const releaseIndex = (strategy: string, index: number) => {
    const indexData = readIndexFile();
    if (!indexData[strategy]) {
        indexData[strategy] = [];
    }

    // 释放索引
    indexData[strategy] = indexData[strategy].filter(i => i !== index);
    writeIndexFile(indexData);
    console.log(`[${strategy}] 释放索引: ${index}`);
};


// 启动一个新的 Bot 进程
const startBot = (strategy: string) => {
    const strategyBots = Array.from(bots.values()).filter(bot => bot.strategy === strategy);
    if (strategyBots.length >= MAX_BOTS_PER_STRATEGY) return;

    const index = getAvailableIndex(strategy); // 分配 index
    const botFile = `./bots/${strategy}Bot.ts`; 
    const bot = fork(botFile, [index.toString()]); // 传递 index
    const botId = bot.pid;

    if (botId) {
        console.log(`✅ 启动Bot进程: ${botId}, 使用 index: ${index}, 策略: ${strategy}`);
        bots.set(botId, { process: bot, index, strategy });
    }

    // 监听子进程的消息
    bot.on("message", (msg: BotMessage) => {
        if (msg.type === "profitReached") {
            console.log(`💰 Bot ${msg.pid} 达到盈利目标，关闭进程`);
            bot.kill();
        }
    });

    // 监听子进程退出
    bot.on("exit", () => {
        console.log(`❌ Bot 进程 ${botId} 退出`);
        if (botId) {
            const { index, strategy } = bots.get(botId)!;
            releaseIndex(strategy, index); // 释放 index
            bots.delete(botId);
            startBot(strategy); // 启动新的Bot，使用相同的策略
        }
    });
};

// 维持最大10个Bot
const maintainBots = (strategy: string) => {
    while (Array.from(bots.values()).filter(bot => bot.strategy === strategy).length < MAX_BOTS_PER_STRATEGY) {
        startBot(strategy);
    }
};

if (require.main === module) {
    const strategy = process.argv[2] || "test"; // 获取策略参数，默认为 "test"
    maintainBots(strategy);
    setInterval(() => maintainBots(strategy), 5000); // 每5秒检查一次  
}