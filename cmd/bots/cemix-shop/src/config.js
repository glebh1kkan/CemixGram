import "dotenv/config";
import { loadPremiumEmoji } from "./premium.js";

function required(env, name) {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integer(env, name, fallback, min = 1) {
  const raw = String(env[name] ?? "").trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${name} must be an integer >= ${min}`);
  return value;
}

export function loadConfig(env = process.env) {
  const get = (name, fallback = "") => String(env[name] ?? fallback).trim();
  return {
    botToken: required(env, "BOT_TOKEN"),
    ownerID: Number(get("OWNER_ID", "8853449340")) || 8853449340,
    api: get("COACHGRAM_API", "http://127.0.0.1:2599").replace(/\/+$/, ""),
    apiToken: required(env, "COACHGRAM_API_TOKEN"),
    actor: get("COACHGRAM_ACTOR", "coach-shop") || "coach-shop",
    databaseURL: required(env, "DATABASE_URL"),
    mainDatabaseURL: get("COACHGRAM_MAIN_DATABASE_URL", ""),
    otpSecret: get("OTP_WEBHOOK_SECRET", ""),
    otpPort: integer(env, "OTP_WEBHOOK_PORT", 8091),
    premiumEmoji: loadPremiumEmoji(env.PREMIUM_EMOJI),
    rate: integer(env, "FG_STARS_PER_TG_STAR", 200),
    rubURL: get("RUB_URL", "https://t.me/luxhold"),
    paybotToken: get("PAYBOT_TOKEN", ""),
    paybotUsername: get("PAYBOT_USERNAME", "oplatastarzbot"),
    panelURL: get("PANEL_URL", "").replace(/\/+$/, ""),
    panelPublicURL: (get("PANEL_PUBLIC_URL", "") || get("PANEL_URL", "")).replace(/\/+$/, ""),
    adminBotSecret: get("ADMIN_BOT_SECRET", ""),
  };
}
