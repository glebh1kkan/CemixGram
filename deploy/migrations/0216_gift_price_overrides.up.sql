-- Per-gift sale price overrides managed from the admin panel.
-- When a row exists, the gift sells for (currency, amount_nanoton) instead of
-- the catalog revision stars price. currency is 'XTR' (amount in stars) or
-- 'TON' (amount in nanoton).
CREATE TABLE IF NOT EXISTS gift_price_overrides (
  gift_id        bigint NOT NULL PRIMARY KEY REFERENCES star_gift_catalog (gift_id) ON DELETE CASCADE,
  currency       text   NOT NULL CHECK (currency IN ('XTR', 'TON')),
  amount_nanoton bigint NOT NULL CHECK (amount_nanoton > 0),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Purchase forms and commands carry the charge currency alongside stars.
ALTER TABLE star_gift_purchase_forms
  ADD COLUMN IF NOT EXISTS charge_currency text NOT NULL DEFAULT 'XTR'
    CHECK (charge_currency IN ('XTR', 'TON'));
ALTER TABLE star_gift_purchase_commands
  ADD COLUMN IF NOT EXISTS charge_currency text NOT NULL DEFAULT 'XTR'
    CHECK (charge_currency IN ('XTR', 'TON'));
