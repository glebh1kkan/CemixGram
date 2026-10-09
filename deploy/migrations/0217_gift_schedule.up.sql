-- Per-gift operator schedule: sale release, upgrade attributes visibility
-- and upgrade action opening. All unix seconds, 0 = off (catalog defaults).
CREATE TABLE IF NOT EXISTS gift_schedule (
  gift_id                 bigint NOT NULL PRIMARY KEY REFERENCES star_gift_catalog (gift_id) ON DELETE CASCADE,
  release_date            integer NOT NULL DEFAULT 0 CHECK (release_date >= 0),
  upgrade_attributes_date integer NOT NULL DEFAULT 0 CHECK (upgrade_attributes_date >= 0),
  upgrade_open_date       integer NOT NULL DEFAULT 0 CHECK (upgrade_open_date >= 0),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
