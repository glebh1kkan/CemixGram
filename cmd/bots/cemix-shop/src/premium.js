// премиум-эмодзи: подмена токенов {name} на кастомные эмодзи телеграма.
// карта: PREMIUM_EMOJI='{"star":{"e":"⭐","id":"5368324170671202286"},...}'
// id добываются так: кинь боту сообщение с премиум-эмодзи — он ответит id.
// встроенные токены — обычные эмодзи; PREMIUM_EMOJI перекрывает их id.
const BUILTIN_TOKENS = {
  star: "⭐", fire: "🔥", gift: "🎁", crown: "👑", whale: "🐳", trophy: "🏆",
  money: "💰", ticket: "🎲", phone: "📱", check: "✅", key: "🔑", link: "🔗",
  chart: "📊", coin: "🪙", rocket: "🚀", gem: "💎", party: "🎉", card: "💳",
};

export function loadPremiumEmoji(raw) {
  const out = {};
  for (const [name, e] of Object.entries(BUILTIN_TOKENS)) {
    out[name] = { e, id: "" };
  }
  try {
    const parsed = JSON.parse(String(raw ?? "") || "{}");
    for (const [name, value] of Object.entries(parsed)) {
      if (value && typeof value.id === "string" && typeof value.e === "string") {
        out[String(name)] = { e: value.e, id: value.id };
      }
    }
  } catch {
    // кривой json — остаёмся на обычных эмодзи
  }
  return out;
}

// заменяет {токен} на эмодзи + entities для custom_emoji.
// оффсеты — в UTF-16 юнитах, как требует Bot API.
export function withPremiumEmojis(text, map) {
  const entities = [];
  let out = "";
  const re = /\{([a-z0-9_]+)\}/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    const entry = map[match[1]];
    if (!entry) continue;
    out += text.slice(last, match.index);
    const start = out.length;
    out += entry.e;
    if (entry.id) {
      entities.push({
        type: "custom_emoji",
        offset: start,
        length: entry.e.length,
        custom_emoji_id: entry.id,
      });
    }
    last = match.index + match[0].length;
  }
  out += text.slice(last);
  return { text: out, entities };
}

// вытаскивает custom_emoji_id из сущностей сообщения.
export function extractPremiumEmojis(entities) {
  const ids = [];
  for (const entity of entities ?? []) {
    if (entity?.type === "custom_emoji" && entity?.custom_emoji_id) {
      ids.push(String(entity.custom_emoji_id));
    }
  }
  return ids;
}
