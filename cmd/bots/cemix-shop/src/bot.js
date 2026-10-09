import { Bot, InlineKeyboard } from "grammy";
import { issuePlusOne, issuePlus888, randomCollectible } from "./numbers.js";
import { withPremiumEmojis, extractPremiumEmojis } from "./premium.js";
import {
  MAX_CUSTOM_TG, MIN_CUSTOM_TG, MIN_GRAMS, MAX_GRAMS, GRAM_PACKAGES, GRAM_RATE_TG, NFT_PACKAGES, NFT_USERNAME_FREE_TG, NFT_USERNAME_TAKEN_TG,
  PACKAGES, WHALE_PACKAGES, fgStarsFor, invoiceFor, customInvoice, nftInvoice,
  nftPackFromPayload, nftPackageById, packageById, parseCustomAmount, parseUsername,
  tgAmountFromPayload, tonFromPayload, tonInvoice, parseGrams, tgForGrams, nanotonsFor, usernameFromPayload, usernameInvoice,
} from "./shop.js";

const DIV = "──────────────";
export { DIV };

export function mainMenu(isOwner = false) {
  const menu = new InlineKeyboard()
    .text("🎲 мой номер", "get_number").row()
    .text("⭐ звёзды", "menu_shop").text("🐳 мажорки", "menu_whales").row()
    .text("🔢 нфт номера", "menu_nft").text("🔗 нфт юзернейм", "menu_username").row()
    .text("🪙 грамы", "menu_ton").row()
    .text("💰 баланс", "menu_balance");
  if (isOwner) {
    menu.row().text("📊 стата", "menu_stats").text("🏆 топ", "menu_top");
  }
  return menu;
}

export function isOwner(ctx, config) {
  return Number(ctx.from?.id) === Number(config.ownerID);
}

function shopKeyboard(rate, rubURL, packs) {
  const keyboard = new InlineKeyboard();
  for (const pack of packs) {
    keyboard.text(`⭐ ${pack.tg} → ${fgStarsFor(pack.tg, rate)}`, `buy:${pack.id}`).row();
  }
  keyboard.text("✏️ своя сумма", "custom_amount").row();
  keyboard.url("₽ рублями", rubURL).text("◀️ меню", "menu_main");
  return keyboard;
}

export function tonMenu() {
  const keyboard = new InlineKeyboard();
  for (const pack of GRAM_PACKAGES) {
    keyboard.text(`🪙 ${pack.grams} gram → ${tgForGrams(pack.grams)} ⭐`, `buy_ton_${pack.grams}`).row();
  }
  keyboard.text("✏️ своя сумма", "custom_grams").row();
  keyboard.text("◀️ меню", "menu_main");
  return keyboard;
}

export function nftMenu() {
  return new InlineKeyboard()
    .text("+888 #### · 150 ⭐", "buy_nft:nft4").row()
    .text("+888 ######## · 75 ⭐", "buy_nft:nft8").row()
    .text("◀️ меню", "menu_main");
}

// отвечает в тот же месседж: в колбэке — редактирует, иначе — новое сообщение.
export async function showText(ctx, text, extra = {}) {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch {
      // сообщение не редактируется — шлём новым
    }
  }
  await ctx.reply(text, extra);
}

const awaitingAmount = new Map();
const awaitingUsername = new Map();
const awaitingGrams = new Map();

// отправка с премиум-эмодзи: токены {name} меняются на эмодзи из карты.
function richText(config, text) {
  return withPremiumEmojis(text, config.premiumEmoji ?? {});
}

export async function say(ctx, config, text, extra = {}) {
  const styled = richText(config, text);
  const merged = { ...extra };
  if (styled.entities.length > 0) {
    merged.entities = [...(extra.entities ?? []), ...styled.entities];
    delete merged.parse_mode;
  }
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(styled.text, merged);
      return;
    } catch {
      // сообщение не редактируется — шлём новым
    }
  }
  await ctx.reply(styled.text, merged);
}

export function createBot({ config, store, cemixgram }) {
  const bot = new Bot(config.botToken);

  bot.command("start", async (ctx) => {
    await say(ctx, config,
      `{party} cemixgram\n${DIV}\n{ticket} жми «мой номер» — выдадим +1\n{phone} введи его в приложении — код придёт сюда\n\n1 номер = 1 аккаунт • cemix`,
      { reply_markup: mainMenu(isOwner(ctx, config)) },
    );
  });

  bot.callbackQuery("menu_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    await say(ctx, config, `{party} cemixgram\n${DIV}\nвыбирай • cemix`, { reply_markup: mainMenu(isOwner(ctx, config)) });
  });

  bot.callbackQuery("get_number", async (ctx) => {
    const existing = await store.phoneByChat(ctx.from.id);
    if (existing) {
      await ctx.answerCallbackQuery();
      await say(ctx, config, `{phone} твой номер: ${existing}\n\n{key} код для входа придёт сюда • cemix`, { reply_markup: mainMenu(isOwner(ctx, config)) });
      return;
    }
    await ctx.answerCallbackQuery("{ticket} подбираю…");
    let phone;
    try {
      phone = await issuePlusOne({ store, cemixgram });
    } catch {
      await say(ctx, config, "😕 не вышло, попробуй позже • cemix", { reply_markup: mainMenu(isOwner(ctx, config)) });
      return;
    }
    try {
      await store.linkPhone(phone, ctx.from.id);
    } catch (error) {
      await say(ctx, config, String(error.message ?? "не вышло").toLowerCase(), { reply_markup: mainMenu(isOwner(ctx, config)) });
      return;
    }
    await say(ctx, config, `{party} твой номер: ${phone}\n\n{phone} введи его в приложении — код придёт сюда • cemix`, { reply_markup: mainMenu(isOwner(ctx, config)) });
  });

  bot.callbackQuery("menu_shop", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendShop(ctx, config, store, PACKAGES);
  });

  bot.callbackQuery("menu_whales", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendShop(ctx, config, store, WHALE_PACKAGES, "🐳 мажорки");
  });

  bot.callbackQuery("menu_nft", async (ctx) => {
    await ctx.answerCallbackQuery();
    const phone = await store.phoneByChat(ctx.from.id);
    if (!phone) {
      await say(ctx, config, "👆 сначала возьми номер — /start");
      return;
    }
    await say(ctx, config, `{gift} нфт номера\n${DIV}\nнавсегда твои, можно перепродать • cemix`, { reply_markup: nftMenu() });
  });

  bot.callbackQuery("menu_username", async (ctx) => {
    const phone = await store.phoneByChat(ctx.from.id);
    if (!phone) {
      await ctx.answerCallbackQuery("👆 сначала возьми номер — /start");
      return;
    }
    awaitingUsername.set(ctx.from.id, true);
    await ctx.answerCallbackQuery();
    await say(ctx, config, `{link} нфт юзернейм\n${DIV}\nнапиши имя (латиница, от 5 символов)\n\nзанятый — выкуп 100 {star}\nсвободный — 50 {star} • cemix`);
  });

  bot.callbackQuery("menu_ton", async (ctx) => {
    await ctx.answerCallbackQuery();
    const phone = await store.phoneByChat(ctx.from.id);
    if (!phone) {
      await say(ctx, config, "👆 сначала возьми номер — /start");
      return;
    }
    await say(ctx, config, `{coin} грамы\n${DIV}\n1 грам = ${GRAM_RATE_TG} {star} тг, от ${MIN_GRAMS} • cemix`, { reply_markup: tonMenu() });
  });

  bot.callbackQuery("menu_balance", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendBalance(ctx, config, store);
  });

  bot.callbackQuery("menu_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isOwner(ctx, config)) {
      await say(ctx, config, "⛔ только для админа • cemix");
      return;
    }
    await sendStats(ctx, config, store);
  });

  bot.callbackQuery("menu_top", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isOwner(ctx, config)) {
      await say(ctx, config, "⛔ только для админа • cemix");
      return;
    }
    await sendTop(ctx, config, bot, store);
  });

  bot.command("stars", async (ctx) => {
    await sendShop(ctx, config, store, PACKAGES);
  });

  bot.command("whales", async (ctx) => {
    await sendShop(ctx, config, store, WHALE_PACKAGES, "🐳 мажорки");
  });

  bot.command("balance", async (ctx) => {
    await sendBalance(ctx, config, store);
  });

  bot.command("stats", async (ctx) => {
    if (!isOwner(ctx, config)) {
      await say(ctx, config, "⛔ только для админа • cemix");
      return;
    }
    await sendStats(ctx, config, store);
  });

  bot.command("top", async (ctx) => {
    if (!isOwner(ctx, config)) {
      await say(ctx, config, "⛔ только для админа • cemix");
      return;
    }
    await sendTop(ctx, config, bot, store);
  });

  // вход в админку только через бота и только овнеру: минтим одноразовый токен.
  bot.command("apanel", async (ctx) => {
    if (!isOwner(ctx, config)) {
      await say(ctx, config, "⛔ только для админа • cemix");
      return;
    }
    if (!config.adminBotSecret || !config.panelURL) {
      await say(ctx, config, "😕 вход через бота не настроен • cemix");
      return;
    }
    try {
      const response = await fetch(`${config.panelURL}/api/internal/bot-login-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: config.adminBotSecret }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`panel ${response.status}`);
      const body = await response.json();
      if (!body?.token) throw new Error("no token");
      await say(ctx, config, `{key} вход в админку (живёт 5 минут, одноразовый) • cemix\n\n${config.panelPublicURL || config.panelURL}/auth/bot?token=${body.token}`);
    } catch (error) {
      await say(ctx, config, "😕 админка не отвечает — проверь позже • cemix");
    }
  });

  async function needAccount(ctx) {
    const phone = await store.phoneByChat(ctx.from.id);
    if (!phone) return 0;
    return cemixgram.resolveUserByPhone(phone).catch(() => 0);
  }

  bot.callbackQuery(/^buy:([a-z0-9]+)$/, async (ctx) => {
    const pack = packageById(ctx.match[1]);
    if (!pack) {
      await ctx.answerCallbackQuery("🤷 нет такого");
      return;
    }
    if (!await needAccount(ctx)) {
      await ctx.answerCallbackQuery("📲 сначала войди в приложение • cemix");
      return;
    }
    await payThroughPaybot(ctx, config, `buy_${pack.id}`);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^buy_nft:(nft[48])$/, async (ctx) => {
    const nft = nftPackageById(ctx.match[1]);
    if (!await needAccount(ctx)) {
      await ctx.answerCallbackQuery("📲 сначала войди в приложение • cemix");
      return;
    }
    await payThroughPaybot(ctx, config, `buy_nft_${nft.id}`);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^buy_ton_([0-9]+(?:\.[0-9]+)?)$/, async (ctx) => {
    const grams = parseGrams(ctx.match[1]);
    if (!grams) {
      await ctx.answerCallbackQuery("🤷 нет такого");
      return;
    }
    if (!await needAccount(ctx)) {
      await ctx.answerCallbackQuery("📲 сначала войди в приложение • cemix");
      return;
    }
    await payThroughPaybot(ctx, config, `buy_ton_${grams}`);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("custom_grams", async (ctx) => {
    if (!await needAccount(ctx)) {
      await ctx.answerCallbackQuery("📲 сначала войди в приложение • cemix");
      return;
    }
    awaitingGrams.set(ctx.from.id, true);
    await ctx.answerCallbackQuery();
    await say(ctx, config, `✏️ сколько грам? (от ${MIN_GRAMS} до ${MAX_GRAMS}) • cemix`);
  });

  bot.callbackQuery("custom_amount", async (ctx) => {
    if (!await needAccount(ctx)) {
      await ctx.answerCallbackQuery("📲 сначала войди в приложение • cemix");
      return;
    }
    awaitingAmount.set(ctx.from.id, true);
    await ctx.answerCallbackQuery();
    await say(ctx, config, `✏️ своя сумма\n${DIV}\nсколько {star} тг? (от ${MIN_CUSTOM_TG} до ${MAX_CUSTOM_TG}) • cemix`);
  });

  // коллектор премиум-эмодзи для овнера: кинь сообщение с эмодзи — бот отдаст id.
  // потом id вписываются в PREMIUM_EMOJI='{"star":{"e":"⭐","id":"..."}}'.
  bot.on("message", async (ctx, next) => {
    if (ctx.from?.id === config.ownerID && !awaitingUsername.has(ctx.from.id) && !awaitingAmount.has(ctx.from.id)) {
      const ids = extractPremiumEmojis(ctx.message?.entities);
      if (ids.length > 0) {
        await say(ctx, config, `{gem} поймал, впиши в PREMIUM_EMOJI • cemix\n\n${ids.join("\n")}`);
        return;
      }
    }
    await next();
  });

  bot.on("message:text", async (ctx) => {
    if (!awaitingUsername.has(ctx.from.id) && !awaitingAmount.has(ctx.from.id)) {
      // свободный текст без активного ввода — подсказываем вместо тишины
      const text = ctx.message.text.trim();
      if (text.startsWith("/")) {
        await say(ctx, config, `🤷 такой команды нет • cemix\n\n/start — меню\n/stars — звёзды`);
        return;
      }
      await say(ctx, config, "👆 жми /start — там всё • cemix", { reply_markup: mainMenu(isOwner(ctx, config)) });
      return;
    }
    if (awaitingUsername.has(ctx.from.id)) {
      const name = parseUsername(ctx.message.text);
      if (!name) {
        await ctx.reply("🔤 так не выйдет — латиница, цифры, _, от 5 символов");
        return;
      }
      awaitingUsername.delete(ctx.from.id);
      if (!await needAccount(ctx)) {
        await ctx.reply("📲 сначала войди в приложение • cemix");
        return;
      }
      const taken = await store.usernameTaken(name).catch(() => false);
      const price = taken ? NFT_USERNAME_TAKEN_TG : NFT_USERNAME_FREE_TG;
      await ctx.reply(taken ? `😬 @${name} занят — выкуп ${price} ⭐ • cemix` : `🎉 @${name} свободен — всего ${price} ⭐ • cemix`);
      await payThroughPaybot(ctx, config, `buy_user_${name}_${price}`);
      return;
    }
    if (awaitingGrams.has(ctx.from.id)) {
      const grams = parseGrams(ctx.message.text);
      if (!grams) {
        await ctx.reply(`🔢 нужно от ${MIN_GRAMS} до ${MAX_GRAMS} грам`);
        return;
      }
      awaitingGrams.delete(ctx.from.id);
      if (!await needAccount(ctx)) {
        await ctx.reply("📲 сначала войди в приложение • cemix");
        return;
      }
      await payThroughPaybot(ctx, config, `buy_ton_${grams}`);
      return;
    }
    if (!awaitingAmount.has(ctx.from.id)) return;
    const amount = parseCustomAmount(ctx.message.text);
    if (!amount) {
      await ctx.reply(`🔢 нужно число от ${MIN_CUSTOM_TG} до ${MAX_CUSTOM_TG}`);
      return;
    }
    awaitingAmount.delete(ctx.from.id);
    if (!await needAccount(ctx)) {
      await ctx.reply("📲 сначала войди в приложение • cemix");
      return;
    }
    await payThroughPaybot(ctx, config, `buy_custom_${amount}`);
  });

  bot.on("pre_checkout_query", async (ctx) => {
    const payload = ctx.preCheckoutQuery.invoice_payload;
    const tgStars = tgAmountFromPayload(payload) || nftPackFromPayload(payload)?.tg || usernameFromPayload(payload)?.tg || 0;
    if (!tgStars || !await needAccount(ctx)) {
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
      await ctx.reply("💸 оплата прошла, а аккаунт не найден — напиши в поддержку");
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

// оплата идёт через отдельного платёжного бота (инвойсы xtr может
// выставлять только тот бот, которому платят): кидаем диплинк.
export async function payThroughPaybot(ctx, config, payload) {
  const url = `https://t.me/${config.paybotUsername}?start=${payload}`;
  await say(ctx, config, `{card} оплата тут • cemix`, {
    reply_markup: {
      inline_keyboard: [[{ text: "💳 платить", url }]],
    },
  });
}

export async function sendInvoiceReply(ctx, invoice) {
  try {
    await ctx.replyWithInvoice(
      invoice.title,
      invoice.description,
      invoice.payload,
      invoice.currency,
      invoice.prices.map((p) => ({ label: p.label, amount: p.amount })),
    );
  } catch (error) {
    console.error("invoice failed:", error.message);
    await ctx.reply("💸 платёж не создался — напиши в поддержку • cemix");
  }
}

// минт случайного свободного +888 после оплаты: dry_run проверяет,
// боевой минт идёт с идемпотентным command_id по charge.
export async function sellNftNumber(ctx, { store, cemixgram, nft, fgUser, chargeID }) {
  for (let i = 0; i < 10; i++) {
    const number = randomCollectible(nft.digits);
    const probe = await cemixgram.mintPhone(fgUser, number, nft.tg, `probe-${chargeID}-${i}`, true).catch(() => null);
    if (!probe) continue;
    const minted = await cemixgram.mintPhone(fgUser, number, nft.tg, chargeID, false).catch(() => null);
    if (!minted) continue;
    await store.recordNft({ tgID: ctx.from.id, nftPhone: number, fgUserID: fgUser, tgStars: nft.tg, digits: nft.digits, chargeID });
    await say(ctx, config, `{party} номер +${number} твой навсегда • cemix`);
    return;
  }
  await ctx.reply("💸 оплата прошла, а свободный номер не подобрался — напиши в поддержку");
}

// начисление грам после оплаты: идемпотентно по charge.
export async function sellTonGrams(ctx, { config, store, ton, fgUser, chargeID }) {
  try {
    const ok = await store.creditTon({
      tgID: ctx.from.id, fgUserID: fgUser,
      grams: ton.grams, nanoton: nanotonsFor(ton.grams), tgStars: ton.tg, chargeID,
    });
    if (!ok) {
      await say(ctx, config, "{check} уже начислено • cemix");
      return;
    }
    await say(ctx, config, `{party} +${ton.grams} gram на балансе • cemix`);
  } catch (error) {
    await say(ctx, config, "💸 оплата прошла, а грамы не начислены — напиши в поддержку • cemix");
  }
}

// минт нфт юзернейма после оплаты: занятость перепроверяем прямо перед минтом.
export async function sellNftUsername(ctx, { store, cemixgram, name, tg, fgUser, chargeID }) {
  const taken = await store.usernameTaken(name).catch(() => true);
  const price = taken ? NFT_USERNAME_TAKEN_TG : NFT_USERNAME_FREE_TG;
  if (price !== tg) {
    await ctx.reply("💸 цена изменилась, пока ты платил — вернись и попробуй ещё");
    return;
  }
  const minted = await cemixgram.mintUsername(fgUser, name, tg, chargeID, false).catch(() => null);
  if (!minted) {
    await ctx.reply("💸 оплата прошла, а юзернейм перехватили — напиши в поддержку");
    return;
  }
  await store.recordNft({ tgID: ctx.from.id, nftPhone: `@${name}`, fgUserID: fgUser, tgStars: tg, digits: 0, chargeID });
  await say(ctx, config, `{party} @${name} твой навсегда • cemix`);
}

export async function sendShop(ctx, config, store, packs = PACKAGES, title = "") {
  const phone = await store.phoneByChat(ctx.from.id);
  if (!phone) {
    await say(ctx, config, "👆 сначала возьми номер — /start");
    return;
  }
  await say(ctx, config, `${title || `{money} курс\n${DIV}\n1 {star} тг = ${config.rate} {star} coach`}`, {
    reply_markup: shopKeyboard(config.rate, config.rubURL, packs),
  });
}

export async function sendBalance(ctx, config, store) {
  const phone = await store.phoneByChat(ctx.from.id);
  if (!phone) {
    await say(ctx, config, "👆 сначала возьми номер — /start");
    return;
  }
  const total = await store.balanceByChat(ctx.from.id);
  await say(ctx, config, `{money} баланс\n${DIV}\n{phone} ${phone}\n{star} куплено: ${total} • cemix`);
}

export async function sendStats(ctx, config, store) {
  const phone = await store.phoneByChat(ctx.from.id);
  if (!phone) {
    await say(ctx, config, "👆 сначала возьми номер — /start");
    return;
  }
  const stats = await store.myStats(ctx.from.id);
  await say(ctx, config,
    `{chart} мой донат\n${DIV}\n{star} звёзды: ${stats.starsN} покупок на ${stats.starsTG} {star} тг\n{gift} нфт: ${stats.nftN} шт на ${stats.nftTG} {star} тг\n{money} всего: ${stats.starsTG + stats.nftTG} {star} тг • cemix`);
}

export async function sendTop(ctx, config, bot, store) {
  const top = await store.weekTop(10);
  if (top.length === 0) {
    await say(ctx, config, "{trophy} за неделю пока пусто — стань первым • cemix");
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = await Promise.all(top.map(async (entry, i) => {
    const badge = medals[i] ?? `${i + 1}.`;
    let name = "аноним";
    try {
      const chat = await bot.api.getChat(entry.tgID);
      name = [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username && `@${chat.username}` || "аноним";
    } catch {
      // чужой акк закрыт — остаётся анонимом
    }
    return `${badge} ${name} — ${entry.total} {star}`;
  }));
  await say(ctx, config, `{trophy} топ недели\n${DIV}\n${lines.join("\n")}\n\n• cemix`);
}
