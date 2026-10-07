import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PACKAGES, WHALE_PACKAGES, fgStarsFor, invoiceFor, customInvoice, packageById, packageByPayload,
  parseCustomAmount, tgAmountFromPayload, nftPackageById, nftPackFromPayload, nftInvoice,
  parseUsername, usernameInvoice, usernameFromPayload, NFT_USERNAME_FREE_TG, NFT_USERNAME_TAKEN_TG,
} from "../src/shop.js";

describe("курс звёзд", () => {
  it("считает 1 к 200", () => {
    assert.equal(fgStarsFor(1, 200), 200);
    assert.equal(fgStarsFor(50, 200), 10000);
  });
  it("мажорки большие", () => {
    assert.ok(WHALE_PACKAGES.every((p) => p.tg >= 1000));
    assert.equal(packageById("w5000")?.tg, 5000);
  });
});

describe("пакеты", () => {
  it("находит пакет по id", () => {
    assert.equal(packageById("s50")?.tg, 50);
    assert.equal(packageById("нет"), null);
  });
  it("разбирает payload инвойса", () => {
    assert.equal(packageByPayload("stars:s150")?.tg, 150);
    assert.equal(packageByPayload("stars:w1000")?.tg, 1000);
    assert.equal(packageByPayload("мусор"), null);
  });
});

describe("своя сумма", () => {
  it("парсит число", () => {
    assert.equal(parseCustomAmount("100"), 100);
    assert.equal(parseCustomAmount(" 1 000 "), 1000);
  });
  it("отвергает мусор и границы", () => {
    assert.equal(parseCustomAmount("0"), 0);
    assert.equal(parseCustomAmount("10001"), 0);
    assert.equal(parseCustomAmount("много"), 0);
  });
  it("достаёт сумму из payload", () => {
    assert.equal(tgAmountFromPayload("stars:s50"), 50);
    assert.equal(tgAmountFromPayload("custom:77"), 77);
    assert.equal(tgAmountFromPayload("custom:0"), 0);
    assert.equal(tgAmountFromPayload("мусор"), 0);
  });
  it("собирает инвойс на свою сумму", () => {
    const invoice = customInvoice(77, 200);
    assert.equal(invoice.payload, "custom:77");
    assert.equal(invoice.prices[0].amount, 77);
  });
});

describe("нфт номера", () => {
  it("два тарифа: 4 цифры за 150, 8 за 75", () => {
    assert.equal(nftPackageById("nft4")?.tg, 150);
    assert.equal(nftPackageById("nft8")?.tg, 75);
  });
  it("парсит nft payload", () => {
    assert.equal(nftPackFromPayload("nft:nft8")?.digits, 8);
    assert.equal(nftPackFromPayload("stars:s50"), null);
  });
});

describe("нфт юзернеймы", () => {
  it("тарифы 100/50", () => {
    assert.equal(NFT_USERNAME_TAKEN_TG, 100);
    assert.equal(NFT_USERNAME_FREE_TG, 50);
  });
  it("парсит юзернейм", () => {
    assert.equal(parseUsername("@Coach_01"), "coach_01");
    assert.equal(parseUsername("ab"), "");
    assert.equal(parseUsername("1abcde"), "");
  });
  it("достаёт юзернейм из payload", () => {
    assert.deepEqual(usernameFromPayload("nftuser:coach:50"), { name: "coach", tg: 50 });
    assert.equal(usernameFromPayload("мусор"), null);
  });
  it("инвойс юзернейма несёт цену", () => {
    const invoice = usernameInvoice("coach", 50, 200);
    assert.equal(invoice.payload, "nftuser:coach:50");
    assert.equal(invoice.prices[0].amount, 50);
  });
});

describe("инвойс", () => {
  it("собирает xtr инвойс с payload", () => {
    const invoice = invoiceFor(packageById("s10"), 200);
    assert.equal(invoice.currency, "XTR");
    assert.equal(invoice.payload, "stars:s10");
    assert.equal(invoice.prices[0].amount, 10);
  });
});

describe("граммы", () => {
  it("считает курс 1 грамм = 50 звёзд", async () => {
    const { tgForGrams, nanotonsFor, parseGrams, tonFromPayload, tonInvoice } = await import("../src/shop.js");
    assert.equal(tgForGrams(0.1), 5);
    assert.equal(tgForGrams(1), 50);
    assert.equal(nanotonsFor(0.1), 100000000);
    assert.equal(parseGrams("2,5"), 2.5);
    assert.equal(parseGrams("0.05"), 0);
    assert.equal(parseGrams("много"), 0);
    assert.deepEqual(tonFromPayload("ton:0.5"), { grams: 0.5, tg: 25 });
    assert.equal(tonFromPayload("ton:0.05"), null);
    const invoice = tonInvoice(1, 50);
    assert.equal(invoice.payload, "ton:1");
    assert.equal(invoice.prices[0].amount, 50);
  });
});
