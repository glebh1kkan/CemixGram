import { Bot } from "grammy";
import { loadConfig } from "./config.js";
import { createStore } from "./store.js";
import { CemixgramClient } from "./cemixgram.js";
import {
  packageById, invoiceFor, customInvoice, nftInvoice, nftPackFromPayload, nftPackageById,
  parseCustomAmount, tgAmountFromPayload, tonFromPayload, tonInvoice,
  usernameFromPayload, usernameInvoice, fgStarsFor, tgForGrams,
} from "./shop.js";
import {
  sendInvoiceReply, sellNftNumber, sellNftUsername, sellTonGrams, say,
} from "./bot.js";

// платёжный бот: только инвойсы и начисления. витрина живёт в основном боте,
// сюда ведут диплинки https://t.me/<paybot>?start=<payload>.
// payload: buy_<packid> | buy_custom_<n> | buy_nft_<id> | buy_user_<name>_<tg>
function parseStartPayload(raw) {
  const text = String(raw ?? "").trim();
  let match = /^buy_([a-z0-9]+)$/.exec(text);
  if (match) {
    const pack = packageById(match[1]);
    if (pack) return { kind: "pack", pack };
  }
  match = /^buy_custom_(\d{1,6})$/.exec(text);
  if (match) {
    const amount = parseCustomAmount(match[1]);
    if (amount) return { kind: "custom", amount };
  }
  match = /^buy_nft_(nft[48])$/.exec(text);
  if (match) {
    const nft = nftPackageById(match[1]);
    if (nft) return { kind: "nft", nft };
  }
  match = /^buy_ton_([0-9]+(?:\.[0-9]+)?)$/.exec(text);
  if (match) {
    const ton = tonFromPayload(`ton:${match[1]}`);
    if (ton) return { kind: "ton", ton };
  }
  match = /^buy_user_([a-z][a-z0-9_]{4,31})_(\d{1,6})$/.exec(text);
  if (match) {
    return { kind: "username", name: match[1], tg: Number(match[2]) };
  }
  return null;
}

export function createPayBot({ config, store, cemixgram }) {
  const bot = new Bot(config.paybotToken);

  bot.command("start", async (ctx) => {
    const order = parseStartPayload(ctx.match);
    if (!order) {
      await say(ctx, config, "👋 оплата тут • cemix\n\nвыбирай товар в основном боте — он пришлёт сюда");
      return;
    }
    const phone = await store.phoneByChat(ctx.from.id);
    const fgUser = phone ? await cemixgram.resolveUserByPhone(phone).catch(() => 0) : 0;
    if (!fgUser) {
      await say(ctx, config, "👆 сначала получи номер и войди в приложение — команды в основном боте • cemix");
      return;
    }
    if (order.kind === "pack") {
      await sendInvoiceReply(ctx, invoiceFor(order.pack, config.rate));
    } else if (order.kind === "custom") {
      await sendInvoiceReply(ctx, customInvoice(order.amount, config.rate));
    } else if (order.kind === "nft") {
      await sendInvoiceReply(ctx, nftInvoice(order.nft, config.rate));
    } else if (order.kind === "ton") {
      await sendInvoiceReply(ctx, tonInvoice(order.ton.grams, tgForGrams(order.ton.grams)));
    } else if (order.kind === "username") {
      await sendInvoiceReply(ctx, usernameInvoice(order.name, order.tg, config.rate));
    }
  });

  bot.on("pre_checkout_query", async (ctx) => {
    const payload = ctx.preCheckoutQuery.invoice_payload;
    const tgStars = tgAmountFromPayload(payload) || nftPackFromPayload(payload)?.tg || usernameFromPayload(payload)?.tg || tonFromPayload(payload)?.tg || 0;
    const phone = await store.phoneByChat(ctx.from.id);
    const fgUser = phone ? await cemixgram.resolveUserByPhone(phone).catch(() => 0) : 0;
    if (!tgStars || !phone || !fgUser) {
      await ctx.answerPreCheckoutQuery(false, "👆 нужен номер и вход в приложение • cemix");
      return;
    }
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    const chargeID = payment.telegram_payment_charge_id;
    if (await store.grantSeen(chargeID) || await store.nftSeen(chargeID)) {
      await say(ctx, config, "{check} уже начислено • cemix");
      return;
    }
    const phone = await store.phoneByChat(ctx.from.id);
    const fgUser = await cemixgram.resolveUserByPhone(phone).catch(() => 0);
    if (!fgUser) {
      await say(ctx, config, "💸 оплата прошла, а аккаунт не найден — напиши в поддержку");
      return;
    }
    const nft = nftPackFromPayload(payment.invoice_payload);
    if (nft) {
      await sellNftNumber(ctx, { store, cemixgram, nft, fgUser, chargeID });
      return;
    }
    const nftUser = usernameFromPayload(payment.invoice_payload);
    if (nftUser) {
      await sellNftUsername(ctx, { store, cemixgram, ...nftUser, fgUser, chargeID });
      return;
    }
    const tgStars = tgAmountFromPayload(payment.invoice_payload);
    if (!tgStars) return;
    const fgStars = fgStarsFor(tgStars, config.rate);
    await cemixgram.grantStars(fgUser, fgStars, `покупка через бота: ${tgStars} tg stars`, chargeID);
    await store.recordGrant({ tgID: ctx.from.id, phone, fgUserID: fgUser, tgStars, fgStars, chargeID });
    await say(ctx, config, `{party} +${fgStars} {star} на балансе • cemix`);
  });

  return bot;
}
