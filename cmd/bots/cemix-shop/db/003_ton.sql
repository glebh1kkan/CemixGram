CREATE TABLE IF NOT EXISTS ton_sales (
  id BIGSERIAL PRIMARY KEY,
  tg_id TEXT NOT NULL,
  fg_user_id BIGINT NOT NULL,
  grams DOUBLE PRECISION NOT NULL,
  nanoton BIGINT NOT NULL,
  tg_stars INTEGER NOT NULL,
  charge_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ton_sales_tg_id_idx ON ton_sales (tg_id);
