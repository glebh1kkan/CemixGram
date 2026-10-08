ALTER TABLE star_gift_purchase_commands DROP COLUMN IF EXISTS charge_currency;
ALTER TABLE star_gift_purchase_forms DROP COLUMN IF EXISTS charge_currency;
DROP TABLE IF EXISTS gift_price_overrides;
