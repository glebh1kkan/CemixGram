// пакеты звёзд: tg stars -> fg stars по курсу.
export const PACKAGES = [
  { id: "s10", tg: 10, label: "10 ⭐" },
  { id: "s50", tg: 50, label: "50 ⭐" },
  { id: "s150", tg: 150, label: "150 ⭐" },
  { id: "s500", tg: 500, label: "500 ⭐" },
];

// мажорки: большие пакеты для китов.
export const WHALE_PACKAGES = [
  { id: "w1000", tg: 1000, label: "1000 ⭐" },
  { id: "w2500", tg: 2500, label: "2500 ⭐" },
  { id: "w5000", tg: 5000, label: "5000 ⭐" },
];

export const MIN_CUSTOM_TG = 1;
export const MAX_CUSTOM_TG = 10000;

// нфт номера +888: короткие дороже.
export const NFT_PACKAGES = [
  { id: "nft4", digits: 4, tg: 150, label: "+888 ####" },
  { id: "nft8", digits: 8, tg: 75, label: "+888 ########" },
];

export const NFT_USERNAME_TAKEN_TG = 100;
export const NFT_USERNAME_FREE_TG = 50;

export function packageById(id) {
  return [...PACKAGES, ...WHALE_PACKAGES].find((p) => p.id === id) ?? null;
}

export function packageByPayload(payload) {
  const match = /^stars:([a-z0-9]+)$/.exec(String(payload ?? ""));
  return match ? packageById(match[1]) : null;
}

export function fgStarsFor(tgStars, rate) {
  return tgStars * rate;
}

export function invoiceFor(pack, rate) {
  const fg = fgStarsFor(pack.tg, rate);
  return {
    title: `звёзды cemixgram × ${pack.tg}`,
    description: `начисляем ${fg} ⭐ cemixgram на твой номер (курс 1 к ${rate})`,
    payload: `stars:${pack.id}`,
    currency: "XTR",
    prices: [{ label: `${fg} ⭐ cemixgram`, amount: pack.tg }],
  };
}

export function customInvoice(tgStars, rate) {
  const fg = fgStarsFor(tgStars, rate);
  return {
    title: `звёзды cemixgram × ${tgStars}`,
    description: `начисляем ${fg} ⭐ cemixgram на твой номер (курс 1 к ${rate})`,
    payload: `custom:${tgStars}`,
    currency: "XTR",
    prices: [{ label: `${fg} ⭐ cemixgram`, amount: tgStars }],
  };
}

// сумма tg stars из payload: пакеты `stars:<id>` и своя сумма `custom:<n>`.
export function tgAmountFromPayload(payload) {
  const pack = packageByPayload(payload);
  if (pack) return pack.tg;
  const match = /^custom:(\d{1,6})$/.exec(String(payload ?? ""));
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount < MIN_CUSTOM_TG || amount > MAX_CUSTOM_TG) return 0;
  return amount;
}

export function parseCustomAmount(raw) {
  const amount = Number(String(raw ?? "").trim().replace(/\s/g, ""));
  if (!Number.isSafeInteger(amount) || amount < MIN_CUSTOM_TG || amount > MAX_CUSTOM_TG) return 0;
  return amount;
}

export function nftPackageById(id) {
  return NFT_PACKAGES.find((p) => p.id === id) ?? null;
}

export function nftPackFromPayload(payload) {
  const match = /^nft:(nft[48])$/.exec(String(payload ?? ""));
  return match ? nftPackageById(match[1]) : null;
}

export function nftInvoice(nft, rate) {
  const fg = fgStarsFor(nft.tg, rate);
  return {
    title: `нфт номер ${nft.label}`,
    description: `случайный номер ${nft.label} в коллекцию (≈ ${fg} ⭐ coach по курсу)`,
    payload: `nft:${nft.id}`,
    currency: "XTR",
    prices: [{ label: `номер ${nft.label}`, amount: nft.tg }],
  };
}

export function parseUsername(raw) {
  const name = String(raw ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(name)) return "";
  return name;
}

export function usernameInvoice(name, tgStars, rate) {
  const fg = fgStarsFor(tgStars, rate);
  return {
    title: `нфт @${name}`,
    description: `@${name} в коллекцию навсегда (≈ ${fg} ⭐ coach по курсу)`,
    payload: `nftuser:${name}:${tgStars}`,
    currency: "XTR",
    prices: [{ label: `@${name}`, amount: tgStars }],
  };
}

export function usernameFromPayload(payload) {
  const match = /^nftuser:([a-z][a-z0-9_]{4,31}):(\d{1,6})$/.exec(String(payload ?? ""));
  if (!match) return null;
  const tg = Number(match[2]);
  if (!Number.isSafeInteger(tg) || tg < 1 || tg > MAX_CUSTOM_TG) return null;
  return { name: match[1], tg };
}
