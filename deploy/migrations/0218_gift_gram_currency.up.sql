-- Sale price currency now includes GRAM alongside XTR (stars) and TON.
-- GRAM is ledger-backed exactly like TON (nanoton amounts).
ALTER TABLE gift_price_overrides DROP CONSTRAINT IF EXISTS gift_price_overrides_currency_check;
ALTER TABLE gift_price_overrides ADD CONSTRAINT gift_price_overrides_currency_check CHECK (currency IN ('XTR', 'TON', 'GRAM'));
ALTER TABLE star_gift_purchase_forms DROP CONSTRAINT IF EXISTS star_gift_purchase_forms_charge_currency_check;
ALTER TABLE star_gift_purchase_forms ADD CONSTRAINT star_gift_purchase_forms_charge_currency_check CHECK (charge_currency IN ('XTR', 'TON', 'GRAM'));
ALTER TABLE star_gift_purchase_commands DROP CONSTRAINT IF EXISTS star_gift_purchase_commands_charge_currency_check;
ALTER TABLE star_gift_purchase_commands ADD CONSTRAINT star_gift_purchase_commands_charge_currency_check CHECK (charge_currency IN ('XTR', 'TON', 'GRAM'));
