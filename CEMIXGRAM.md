# CemixGram — self-hosted Telegram-compatible server (gramsrv monolith fork)

Fork of `gramsrv` branch `main` (monolith), user-visible identity rebranded to CemixGram.
Go module and env prefix stay `telesrv` / `TELESRV_*` on purpose (see AGENTS.md:
protocol identifiers, client detection tokens, metrics, database objects and module paths are not renamed).

## Services

| what | where |
|---|---|
| MTProto | `0.0.0.0:2398`, advertise `150.241.70.48:2398`, DC 2 |
| public links / healthz | `127.0.0.1:2401` |
| admin API | `127.0.0.1:2599` |
| APK | `CemixGram.apk` (org.cemixgram.android, Telegram icon, no server select) |

## Rebrand deltas vs upstream

- `internal/branding`: CemixGram defaults.
- `internal/links`: `https://cemixgram.net`, `https://weba.cemixgram.net`, scheme `cemixgram`.
- `internal/config`: passkey RP `cemixgram.net`.
- `internal/rpc/aicompose_webpage.go`: host allowlist extended.

## Android client (CemixGram-android)

- single server `150.241.70.48:2398` baked in (+ server RSA key), DC 2
- no server-selection UI: straight to LoginActivity, server auto-bound
- package `org.cemixgram.android`, Telegram plane icon + intro art
- reactions refresh without hourly gate

## Seeds

seed snapshots live in `seed-src/` (fetched from official Telegram with an
authorized session), wired into the server via `data/`:

- `data/official-gifts` -> gifts + NFT upgrade attributes
- `data/sticker-seed/telegram_emoji_export/*` -> emoji/status/topic/gift sets
- `data/sticker-seed/telegram_effects_export` -> message effects
- `data/sticker-seed/telegram_reactions_export` -> 74 reactions
- fetchers: `bin/fetchers/{giftfetch,stickerfetch,catalogfetch,appearancefetch,reactionfetch}`
