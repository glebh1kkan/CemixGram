import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../src/store.js";

const testURL = process.env.TEST_DATABASE_URL ?? "postgres://cemixgram:coachgram@127.0.0.1:5432/cemixgram_shop_test";

describe("связь номер-аккаунт 1 к 1", () => {
  let store;
  before(async () => {
    const admin = new pg.Pool({ connectionString: "postgres://cemixgram:coachgram@127.0.0.1:5432/cemixgram_main" });
    try {
      await admin.query("CREATE DATABASE cemix_shop_test OWNER cemix");
    } catch { /* уже есть */ }
    await admin.end();
    const pool = new pg.Pool({ connectionString: testURL });
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db");
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await pool.query(readFileSync(join(dir, name), "utf8"));
    }
    await pool.query("TRUNCATE links, deliveries, grants, nft_sales");
    await pool.end();
    store = createStore(testURL);
  });

  it("привязывает номер к аккаунту", async () => {
    await store.linkPhone("+70000000001", 111);
    assert.equal(await store.chatByPhone("+70000000001"), 111);
    assert.equal(await store.phoneByChat(111), "+70000000001");
  });

  it("не даёт номер чужому аккаунту", async () => {
    await assert.rejects(store.linkPhone("+70000000001", 222), /другому аккаунту/);
  });

  it("не даёт второй номер тому же аккаунту", async () => {
    await assert.rejects(store.linkPhone("+70000000002", 111), /другой номер/);
  });

  it("гранты идемпотентны по charge", async () => {
    await store.recordGrant({ tgID: 111, phone: "+70000000001", fgUserID: 5, tgStars: 10, fgStars: 2000, chargeID: "ch_1" });
    await store.recordGrant({ tgID: 111, phone: "+70000000001", fgUserID: 5, tgStars: 10, fgStars: 2000, chargeID: "ch_1" });
    assert.equal(await store.grantSeen("ch_1"), 2000);
    assert.equal(await store.balanceByChat(111), 2000);
  });

  it("нфт продажи идемпотентны", async () => {
    await store.recordNft({ tgID: 111, nftPhone: "+8881234", fgUserID: 5, tgStars: 150, digits: 4, chargeID: "nft_1" });
    assert.equal(await store.nftSeen("nft_1"), true);
    assert.equal(await store.nftSeen("nft_2"), false);
  });

  it("считает стату и топ недели", async () => {
    await store.recordGrant({ tgID: 222, phone: "+70000000009", fgUserID: 9, tgStars: 50, fgStars: 10000, chargeID: "ch_9" });
    const stats = await store.myStats(222);
    assert.equal(stats.starsTG, 50);
    assert.equal(stats.starsN, 1);
    const top = await store.weekTop(10);
    assert.ok(top.length >= 2);
    assert.equal(top[0].tgID, 111);
    assert.equal(top[0].total, 160);
  });
});
