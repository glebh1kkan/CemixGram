// нормализация номеров: только e.164, иначе null.
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length > 15) return null;
  // локальные форматы: 8xxxxxxxxxx -> 7xxxxxxxxxx (но не +888 коллекционные)
  if (digits.length === 11 && digits.startsWith("8") && !digits.startsWith("888")) digits = "7" + digits.slice(1);
  if (digits.length < 7 || digits.length > 15) return null;
  return "+" + digits;
}

export function isPlusOne(phone) {
  return /^\+1[2-9]\d{9}$/.test(String(phone ?? ""));
}
