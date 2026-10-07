import { createServer } from "node:http";
import { parseDelivery, verifySignature } from "./otp.js";
import { normalizePhone } from "./phone.js";

// вебхук доставки отп: cemix постит сюда коды, бот пересылает их в лички.
// контракт: docs/otp-delivery.md (post, подпись sha256=<hmac(timestamp.raw)>).
export function createOtpServer({ secret, bot, store }) {
  return createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" }).end('{"accepted":false}');
      return;
    }
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 65536) req.destroy();
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      const ok = verifySignature(secret, req.headers["x-telesrv-timestamp"], raw, req.headers["x-telesrv-signature"]);
      if (!ok) {
        res.writeHead(401, { "content-type": "application/json" }).end('{"accepted":false}');
        return;
      }
      let delivery;
      try {
        delivery = parseDelivery(raw);
      } catch {
        res.writeHead(400, { "content-type": "application/json" }).end('{"accepted":false}');
        return;
      }
      handleDelivery({ bot, store }, delivery).then(
        (messageID) => {
          res.writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({ accepted: true, message_id: String(messageID) }));
        },
        () => {
          res.writeHead(200, { "content-type": "application/json" }).end('{"accepted":false}');
        },
      );
    });
  });
}

export async function handleDelivery({ bot, store }, delivery) {
  if (await store.deliverySeen(delivery.deliveryID)) return "duplicate";
  const phone = normalizePhone(delivery.recipient);
  if (!phone) throw new Error("bad recipient");
  const chatID = await store.chatByPhone(phone);
  if (!chatID) throw new Error("unknown recipient");
  const sent = await bot.api.sendMessage(
    chatID,
    `🔑 код: <code>${delivery.code}</code>\n⏳ живёт 5 минут, никому не показывай • cemix`,
    { parse_mode: "HTML" },
  );
  await store.markDelivery(delivery.deliveryID, phone);
  return sent.message_id;
}
