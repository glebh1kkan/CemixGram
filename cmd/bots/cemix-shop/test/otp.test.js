import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySignature, parseDelivery } from "../src/otp.js";

function sign(secret, timestamp, raw) {
  return `sha256=${createHmac("sha256", secret).update(String(timestamp)).update(".").update(raw).digest("hex")}`;
}

describe("подпись вебхука", () => {
  it("принимает корректную подпись", () => {
    const raw = Buffer.from('{"version":"1"}');
    const ts = Math.floor(Date.now() / 1000);
    assert.equal(verifySignature("secret", ts, raw, sign("secret", ts, raw)), true);
  });
  it("отвергает чужую подпись", () => {
    const raw = Buffer.from('{"version":"1"}');
    const ts = Math.floor(Date.now() / 1000);
    assert.equal(verifySignature("secret", ts, raw, sign("other", ts, raw)), false);
  });
  it("отвергает старую метку", () => {
    const raw = Buffer.from('{"version":"1"}');
    const ts = Math.floor(Date.now() / 1000) - 1000;
    assert.equal(verifySignature("secret", ts, raw, sign("secret", ts, raw)), false);
  });
});

describe("разбор доставки", () => {
  it("парсит валидную доставку", () => {
    const raw = Buffer.from(JSON.stringify({
      version: "1",
      delivery_id: "otp_abc",
      purpose: "login_sms",
      channel: "sms",
      recipient: "+79677791048",
      code: "68756",
      expires_at: new Date(Date.now() + 300_000).toISOString(),
    }));
    const delivery = parseDelivery(raw);
    assert.equal(delivery.code, "68756");
  });
  it("роняет просроченную", () => {
    const raw = Buffer.from(JSON.stringify({
      version: "1",
      delivery_id: "otp_old",
      recipient: "+79677791048",
      code: "00000",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }));
    assert.throws(() => parseDelivery(raw), /expired/);
  });
});
