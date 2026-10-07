import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, isPlusOne } from "../src/phone.js";

describe("номера", () => {
  it("принимает e164 как есть", () => {
    assert.equal(normalizePhone("+79677791048"), "+79677791048");
  });
  it("чистит мусор", () => {
    assert.equal(normalizePhone("+7 (967) 779-10-48"), "+79677791048");
  });
  it("переводит восьмёрку в семёрку", () => {
    assert.equal(normalizePhone("89677791048"), "+79677791048");
  });
  it("не трогает +888 коллекционные", () => {
    assert.equal(normalizePhone("+8881234"), "+8881234");
    assert.equal(normalizePhone("+88836013371"), "+88836013371");
  });
  it("отвергает мусор", () => {
    assert.equal(normalizePhone("123"), null);
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone(null), null);
  });
  it("отличает +1", () => {
    assert.equal(isPlusOne("+14155552671"), true);
    assert.equal(isPlusOne("+79677791048"), false);
  });
});
