CREATE TABLE IF NOT EXISTS nft_sales (
  id BIGSERIAL PRIMARY KEY,
  tg_id TEXT NOT NULL,
  nft_phone TEXT NOT NULL,
  fg_user_id BIGINT NOT NULL,
  tg_stars INTEGER NOT NULL,
  digits INTEGER NOT NULL,
  charge_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nft_sales_tg_id_idx ON nft_sales (tg_id);
