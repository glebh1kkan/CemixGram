import { Bot } from "grammy";
import { loadConfig } from "./config.js";
import { createStore } from "./store.js";
import { CemixgramClient } from "./cemixgram.js";
import { createPayBot } from "./payments.js";

const config = loadConfig();
if (!config.paybotToken) throw new Error("PAYBOT_TOKEN is required");
const store = createStore(config.databaseURL, config.mainDatabaseURL);
const cemixgram = new CemixgramClient(config.api, config.apiToken, config.actor);

const me = await new Bot(config.paybotToken).api.getMe();
console.log(`платёжный бот @${me.username}`);

const bot = createPayBot({ config, store, cemixgram });
bot.catch((error) => console.error("paybot error:", error.message));
await bot.start();
