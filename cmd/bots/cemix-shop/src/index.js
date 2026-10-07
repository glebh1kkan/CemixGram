import { Bot } from "grammy";
import { loadConfig } from "./config.js";
import { createStore } from "./store.js";
import { CemixgramClient } from "./cemixgram.js";
import { createBot } from "./bot.js";
import { createOtpServer } from "./otpwebhook.js";

const config = loadConfig();
const store = createStore(config.databaseURL, config.mainDatabaseURL);
const cemix = new CemixgramClient(config.api, config.apiToken, config.actor);

const me = await new Bot(config.botToken).api.getMe();
console.log(`бот @${me.username}, курс 1 к ${config.rate}`);

const bot = createBot({ config, store, cemix });
if (config.otpSecret) {
  const otp = createOtpServer({ secret: config.otpSecret, bot, store });
  otp.listen(config.otpPort, "127.0.0.1", () => console.log(`отп вебхук на 127.0.0.1:${config.otpPort}`));
}

bot.catch((error) => console.error("bot error:", error.message));
await bot.start();
