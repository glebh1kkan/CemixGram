import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

function env(overrides = {}) {
  return {
    BOT_TOKEN: "t",
    DATABASE_URL: "postgres://x",
    COACHGRAM_API_TOKEN: "tok",
    ...overrides,
  };
}

describe("конфиг", () => {
  it("берёт дефолты", () => {
    const config = loadConfig(env());
    assert.equal(config.api, "http://127.0.0.1:2599");
    assert.equal(config.rate, 200);
    assert.equal(config.ownerID, 8853449340);
    assert.equal(config.rubURL, "https://t.me/luxhold");
  });
  it("требует токен бота", () => {
    assert.throws(() => loadConfig(env({ BOT_TOKEN: "" })), /BOT_TOKEN/);
  });
  it("требует токен api", () => {
    assert.throws(() => loadConfig(env({ COACHGRAM_API_TOKEN: "" })), /COACHGRAM_API_TOKEN/);
  });
});
