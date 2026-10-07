import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadPremiumEmoji, withPremiumEmojis, extractPremiumEmojis } from "../src/premium.js";

describe("премиум эмодзи", () => {
  it("меняет токены на эмодзи", () => {
    const out = withPremiumEmojis("привет {star}!", loadPremiumEmoji(""));
    assert.equal(out.text, "привет ⭐!");
    assert.deepEqual(out.entities, []);
  });
  it("строит entities с utf-16 оффсетами", () => {
    const map = loadPremiumEmoji('{"star":{"e":"⭐","id":"123"}}');
    const out = withPremiumEmojis("👋 {star}!", map);
    assert.equal(out.text, "👋 ⭐!");
    // 👋 = 2 юнита + пробел = 3
    assert.equal(out.entities[0].offset, 3);
    assert.equal(out.entities[0].length, "⭐".length);
    assert.equal(out.entities[0].custom_emoji_id, "123");
  });
  it("неизвестные токены не трогает", () => {
    const out = withPremiumEmojis("баланс {xyz}", loadPremiumEmoji(""));
    assert.equal(out.text, "баланс {xyz}");
  });
  it("кривой json даёт дефолты", () => {
    const map = loadPremiumEmoji("не json");
    assert.equal(map.star.e, "⭐");
  });
  it("вытаскивает id из сущностей", () => {
    const ids = extractPremiumEmojis([{ type: "custom_emoji", custom_emoji_id: "1" }, { type: "bold" }]);
    assert.deepEqual(ids, ["1"]);
  });
});
