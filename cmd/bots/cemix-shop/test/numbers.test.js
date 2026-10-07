import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomPlusOne, randomCollectible, issuePlus888 } from "../src/numbers.js";
import { isPlusOne } from "../src/phone.js";

describe("случайный номер +1", () => {
  it("генерирует валидный nanp", () => {
    for (let i = 0; i < 50; i++) {
      assert.match(randomPlusOne(), /^\+1[2-9]\d{9}$/);
    }
  });
  it("генерит +888 нужной длины", () => {
    for (let i = 0; i < 20; i++) {
      assert.match(randomCollectible(4), /^\+888\d{4}$/);
      assert.match(randomCollectible(8), /^\+888\d{8}$/);
    }
  });
  it("isPlusOne отличает +1", () => {
    assert.equal(isPlusOne("+14155552671"), true);
    assert.equal(isPlusOne("+79677791048"), false);
  });
});

describe("выдача номера", () => {
  it("падает когда всё занято", async () => {
    const store = { chatByPhone: async () => 1 };
    const cemix = { resolveUserByPhone: async () => 0 };
    await assert.rejects(issuePlus888({ store, cemix, tries: 2 }), /не вышло подобрать/);
  });
  it("выдаёт свободный +888", async () => {
    const store = { chatByPhone: async () => 0 };
    const cemix = { resolveUserByPhone: async () => 0 };
    const phone = await issuePlus888({ store, cemix, tries: 3 });
    assert.match(phone, /^\+888\d{8}$/);
  });
});
