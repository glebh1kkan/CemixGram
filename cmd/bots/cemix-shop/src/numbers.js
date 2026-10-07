import { randomInt } from "node:crypto";
import { normalizePhone } from "./phone.js";

// случайный виртуальный номер +1 (nanp: +1 nxx-nxx-xxxx, n = 2..9).
// коды на него всё равно приходят в бота через вебхук, смс не нужна.
export function randomPlusOne(pick = randomInt) {
  const digit = () => String(pick(0, 10));
  const first = String(pick(2, 10));
  let digits = "1" + first;
  for (let i = 0; i < 9; i++) digits += digit();
  return normalizePhone("+" + digits);
}

// случайный коллекционный +888 из n цифр после 888.
export function randomCollectible(digits, pick = randomInt) {
  let number = "888";
  for (let i = 0; i < digits; i++) number += String(pick(0, 10));
  return normalizePhone("+" + number);
}

// подбирает свободный номер +1 для выдачи: нет в нашей базе и нет на сервере.
export async function issuePlusOne({ store, cemix, tries = 25, pick } = {}) {
  for (let i = 0; i < tries; i++) {
    const phone = randomPlusOne(pick);
    if (await store.chatByPhone(phone)) continue;
    const taken = await cemix.resolveUserByPhone(phone).catch(() => 0);
    if (taken) continue;
    return phone;
  }
  throw new Error("не вышло подобрать свободный номер, попробуй позже");
}

// подбирает свободный +888 для входа: нет в нашей базе и нет на сервере.
// +888 — виртуальные номера: смс не нужна, код приходит в бота.
export async function issuePlus888({ store, cemix, digits = 8, tries = 25, pick } = {}) {
  for (let i = 0; i < tries; i++) {
    const phone = randomCollectible(digits, pick);
    if (await store.chatByPhone(phone)) continue;
    const taken = await cemix.resolveUserByPhone(phone).catch(() => 0);
    if (taken) continue;
    return phone;
  }
  throw new Error("не вышло подобрать свободный номер, попробуй позже");
}
