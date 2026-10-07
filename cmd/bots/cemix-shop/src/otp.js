import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function secureEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

// проверка подписи вебхука telesrv: hmac-sha256("<timestamp>.<raw body>").
export function verifySignature(secret, timestamp, raw, signature) {
  if (!secret) return false;
  if (!/^\d{1,20}$/.test(String(timestamp ?? ""))) return false;
  const unix = Number(timestamp);
  if (!Number.isSafeInteger(unix)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - unix) > 300) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(String(timestamp)).update(".").update(raw).digest("hex")}`;
  return secureEqual(expected, String(signature ?? ""));
}

export function parseDelivery(raw) {
  const payload = JSON.parse(raw.toString("utf8"));
  const deliveryID = String(payload.delivery_id ?? "").trim();
  const code = String(payload.code ?? "").trim();
  const recipient = String(payload.recipient ?? "").trim();
  const purpose = String(payload.purpose ?? "").trim();
  const channel = String(payload.channel ?? "").trim();
  const expiresAt = Math.floor(Date.parse(String(payload.expires_at ?? "")) / 1000);
  if (payload.version !== "1" || !deliveryID || deliveryID.length > 128) throw new Error("bad delivery_id");
  if (!/^[0-9A-Za-z_-]{1,32}$/.test(code)) throw new Error("bad code");
  if (!recipient || recipient.length > 512) throw new Error("bad recipient");
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= Date.now()) throw new Error("expired");
  return { deliveryID, code, recipient, purpose, channel, expiresAt };
}

export function deliveryFingerprint(raw) {
  return createHash("sha256").update(raw).digest("hex");
}
