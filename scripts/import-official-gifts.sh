#!/usr/bin/env bash
# Bulk-import every regular gift from a giftfetch snapshot (manifest.json)
# into CemixGram through the admin panel API.
#
# 1) Скачать все подарки Telegram (полный снапшот с атрибутами улучшений):
#      SESSION=/path/to/session go run ./cmd/giftfetch -out data/official-gifts -workers 8
#    докачка/продолжение: scripts/gift-resume.sh
#    (TELESRV_OFFICIAL_GIFTS_DIR=data/official-gifts — сервер читает этот
#    снапшот read-only, импорт идёт только явным выбором в админке или этим скриптом)
#
# 2) Массовый импорт:
#      ADMIN_BASE=http://127.0.0.1:2600 COOKIE='session=...' \
#        scripts/import-official-gifts.sh [--dry-run] [--dir data/official-gifts]
#
#    Опционально (единые для всех импортируемых подарков):
#      PRICE_CURRENCY=XTR|TON|GRAM  PRICE_AMOUNT=1.5
#        (XTR — звёзды целым числом; TON/GRAM — десятичные криптоединицы)
#      UPGRADE_ATTRS_AT='2026-12-01 12:00'  UPGRADE_OPEN_AT='2026-12-08 12:00'
#        (когда выйдут улучшения: видимость атрибутов и открытие апгрейда;
#         пусто = сразу; формат — любое, понятное `date -d`)
#      GIFT_IDS='123,456'  (импортировать только эти source_gift_id)
#      SLEEP=0.5  (пауза между подарками)
set -euo pipefail

DRY_RUN=0
DIR="data/official-gifts"
ADMIN_BASE="${ADMIN_BASE:-http://127.0.0.1:2600}"
COOKIE="${COOKIE:-}"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --dir=*) DIR="${arg#--dir=}" ;;
    --dir) shift ;;
  esac
done
if [[ "${1:-}" != "" && "${1:-}" != --* && -d "${1:-}" ]]; then DIR="$1"; fi

if [[ -z "$COOKIE" ]]; then
  echo "ERROR: COOKIE is required (admin panel session cookie, e.g. COOKIE='session=...')." >&2
  echo "Войдите в админку в браузере, скопируйте cookie и повторите." >&2
  exit 2
fi

export DIR ADMIN_BASE COOKIE DRY_RUN \
  PRICE_CURRENCY="${PRICE_CURRENCY:-}" PRICE_AMOUNT="${PRICE_AMOUNT:-}" \
  UPGRADE_ATTRS_AT="${UPGRADE_ATTRS_AT:-}" UPGRADE_OPEN_AT="${UPGRADE_OPEN_AT:-}" \
  GIFT_IDS="${GIFT_IDS:-}" SLEEP="${SLEEP:-0.3}" REASON="${REASON:-bulk official import}"

python3 - <<'EOF'
import json, os, sys, time, urllib.request, urllib.error

d = os.environ["DIR"]
base = os.environ["ADMIN_BASE"].rstrip("/")
cookie = os.environ["COOKIE"]
dry = os.environ["DRY_RUN"] == "1"
sleep_s = float(os.environ.get("SLEEP") or 0.3)
reason = os.environ.get("REASON") or "bulk official import"

manifest = json.load(open(os.path.join(d, "manifest.json")))
gifts = [g for g in manifest.get("gifts", []) if g.get("kind") == "regular"]
attr_gifts = {s["gift_id"] for s in manifest.get("upgrade_attribute_sets", [])}
only = {x.strip() for x in (os.environ.get("GIFT_IDS") or "").split(",") if x.strip()}
if only:
    gifts = [g for g in gifts if str(g["id"]) in only]

def to_unix(s):
    import datetime
    s = (s or "").strip()
    if not s: return 0
    try: return int(datetime.datetime.fromisoformat(s).timestamp())
    except Exception: return 0

price_currency = (os.environ.get("PRICE_CURRENCY") or "").strip().upper()
price_amount_raw = (os.environ.get("PRICE_AMOUNT") or "").strip()
price_amount = 0
if price_amount_raw:
    v = float(price_amount_raw.replace(",", "."))
    if price_currency == "XTR":
        price_amount = str(int(v))
    else:
        if price_currency not in ("TON", "GRAM"): raise SystemExit("PRICE_CURRENCY must be XTR|TON|GRAM")
        price_amount = str(int(round(v * 1e9)))

attrs_at = os.environ.get("UPGRADE_ATTRS_AT") or ""
open_at = os.environ.get("UPGRADE_OPEN_AT") or ""
import time as _t
def parse_dt(s):
    s = (s or "").strip()
    if not s: return 0
    fmts = ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%d")
    import datetime
    for f in fmts:
        try: return int(datetime.datetime.strptime(s, f).timestamp())
        except Exception: pass
    raise SystemExit(f"bad datetime: {s}")
attrs_unix, open_unix = parse_dt(attrs_at), parse_dt(open_at)

def post(payload):
    req = urllib.request.Request(base + "/api/actions/import-official-gift",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Cookie": cookie})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:500]}

ok, fail, skip = 0, 0, 0
for g in gifts:
    sid = str(g["id"])
    can_upgrade = g["id"] in attr_gifts
    payload = {
        "source_gift_id": sid, "gift_id": "0",
        "title": g.get("title") or f"Official gift {sid}",
        "stars": str(g.get("stars") or 50),
        "convert_stars": str(g.get("convert_stars") or 0),
        "enabled": True, "support_only": False,
        "require_premium": bool(g.get("require_premium")),
        "birthday": bool(g.get("birthday")),
        "availability_total": int(g.get("availability_total") or 0),
        "released_by_peer": "", "per_user_total": int(g.get("per_user_total") or 0),
        "sort_order": 0, "include_collectible": can_upgrade,
        "upgrade_stars": str(g.get("upgrade_stars") or 0),
        "supply_total": int(g.get("availability_total") or 0),
        "slug_prefix": f"official-{sid}", "locked_until_date": 0,
        "reason": reason, "confirm": False,
    }
    if price_amount_raw:
        payload["price_currency"] = price_currency
        payload["price_amount_nanoton"] = price_amount
    if attrs_unix: payload["upgrade_attributes_date"] = attrs_unix
    if open_unix: payload["upgrade_open_date"] = open_unix
    st, body = post(payload)
    detail = body.get("details", {}) if isinstance(body, dict) else {}
    if st != 200:
        # уже импортирован — сервер вернёт конфликт/дубликат: пропускаем
        text = json.dumps(body)[:200]
        if "exists" in text or "duplicate" in text or "CONFLICT" in text:
            skip += 1
            print(f"SKIP {sid} {text}")
        else:
            fail += 1
            print(f"FAIL dry-run {sid} http={st} {text}")
        continue
    cmd = (body.get("command_id") or detail.get("command_id") or "")
    if dry:
        ok += 1
        print(f"OK dry-run {sid} {g.get('title','')[:40]}")
        continue
    payload["confirm"] = True
    if cmd: payload["command_id"] = cmd
    st2, body2 = post(payload)
    if st2 == 200:
        ok += 1
        print(f"OK import {sid} {g.get('title','')[:40]}")
    else:
        fail += 1
        print(f"FAIL import {sid} http={st2} {json.dumps(body2)[:200]}")
    time.sleep(sleep_s)
print(f"done: ok={ok} skip={skip} fail={fail} total={len(gifts)} dry_run={dry}")
sys.exit(1 if fail else 0)
EOF
