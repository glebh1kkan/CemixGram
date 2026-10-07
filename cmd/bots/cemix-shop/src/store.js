import pg from "pg";

// связь номер<->тг: строго 1 к 1 в обе стороны.
// гранты, нфт-продажи и доставки для идемпотентности.
// mainPool — ридонли доступ к базе cemix (занятость юзернеймов, топ донатеров).
export function createStore(databaseURL, mainDatabaseURL = "") {
  const pool = new pg.Pool({ connectionString: databaseURL });
  const main = mainDatabaseURL ? new pg.Pool({ connectionString: mainDatabaseURL }) : null;

  return {
    pool,

    // занят ли юзернейм: обычный реестр или коллекционные.
    async usernameTaken(name) {
      if (!main) return false;
      const lower = String(name ?? "").toLowerCase();
      const peer = await main.query(
        "SELECT 1 FROM peer_usernames WHERE username_lower = $1 AND active LIMIT 1", [lower],
      );
      if (peer.rowCount > 0) return true;
      const nft = await main.query(
        "SELECT 1 FROM collectible_usernames WHERE username_lower = $1 LIMIT 1", [lower],
      );
      return nft.rowCount > 0;
    },

    async linkPhone(phone, tgID) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const byPhone = await client.query("SELECT tg_id FROM links WHERE phone = $1", [phone]);
        if (byPhone.rowCount > 0 && Number(byPhone.rows[0].tg_id) !== Number(tgID)) {
          throw Object.assign(new Error("номер уже привязан к другому аккаунту"), { code: "phone_taken" });
        }
        const byTg = await client.query("SELECT phone FROM links WHERE tg_id = $1", [String(tgID)]);
        if (byTg.rowCount > 0 && byTg.rows[0].phone !== phone) {
          throw Object.assign(new Error("у тебя уже привязан другой номер"), { code: "account_taken" });
        }
        await client.query(
          `INSERT INTO links (phone, tg_id) VALUES ($1, $2)
           ON CONFLICT (phone) DO UPDATE SET tg_id = EXCLUDED.tg_id`,
          [phone, String(tgID)],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async chatByPhone(phone) {
      const result = await pool.query("SELECT tg_id FROM links WHERE phone = $1", [phone]);
      return result.rowCount > 0 ? Number(result.rows[0].tg_id) : 0;
    },

    async phoneByChat(tgID) {
      const result = await pool.query("SELECT phone FROM links WHERE tg_id = $1", [String(tgID)]);
      return result.rowCount > 0 ? result.rows[0].phone : "";
    },

    async deliverySeen(deliveryID) {
      const result = await pool.query("SELECT 1 FROM deliveries WHERE delivery_id = $1", [deliveryID]);
      return result.rowCount > 0;
    },

    async markDelivery(deliveryID, phone) {
      await pool.query("INSERT INTO deliveries (delivery_id, phone) VALUES ($1, $2) ON CONFLICT DO NOTHING", [deliveryID, phone]);
    },

    async grantSeen(chargeID) {
      const result = await pool.query("SELECT fg_stars FROM grants WHERE charge_id = $1", [chargeID]);
      return result.rowCount > 0 ? Number(result.rows[0].fg_stars) : 0;
    },

    async recordGrant({ tgID, phone, fgUserID, tgStars, fgStars, chargeID }) {
      await pool.query(
        `INSERT INTO grants (tg_id, phone, fg_user_id, tg_stars, fg_stars, charge_id)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (charge_id) DO NOTHING`,
        [String(tgID), phone, fgUserID, tgStars, fgStars, chargeID],
      );
    },

    async nftSeen(chargeID) {
      const result = await pool.query("SELECT 1 FROM nft_sales WHERE charge_id = $1", [chargeID]);
      return result.rowCount > 0;
    },

    async recordNft({ tgID, nftPhone, fgUserID, tgStars, digits, chargeID }) {
      await pool.query(
        `INSERT INTO nft_sales (tg_id, nft_phone, fg_user_id, tg_stars, digits, charge_id)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (charge_id) DO NOTHING`,
        [String(tgID), nftPhone, fgUserID, tgStars, digits, chargeID],
      );
    },

    async balanceByChat(tgID) {
      const result = await pool.query("SELECT COALESCE(SUM(fg_stars), 0) AS total FROM grants WHERE tg_id = $1", [String(tgID)]);
      return Number(result.rows[0].total);
    },

    // начисление граммов ton напрямую в ledger сервера.
    async creditTon({ tgID, fgUserID, grams, nanoton, tgStars, chargeID }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const seen = await client.query("SELECT 1 FROM ton_sales WHERE charge_id = $1", [chargeID]);
        if (seen.rowCount > 0) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query(
          `INSERT INTO ton_sales (tg_id, fg_user_id, grams, nanoton, tg_stars, charge_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [String(tgID), fgUserID, grams, String(nanoton), tgStars, chargeID],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      if (!main) throw new Error("нет доступа к базе сервера");
      const mclient = await main.connect();
      try {
        await mclient.query("BEGIN");
        await mclient.query(
          `INSERT INTO ton_balances (user_id, balance_nanoton, granted, updated_at)
           VALUES ($1, $2, true, now())
           ON CONFLICT (user_id) DO UPDATE SET balance_nanoton = ton_balances.balance_nanoton + EXCLUDED.balance_nanoton, updated_at = now()`,
          [fgUserID, String(nanoton)],
        );
        await mclient.query(
          `INSERT INTO ton_transactions (user_id, amount_nanoton, reason, date)
           VALUES ($1, $2, $3, $4)`,
          [fgUserID, String(nanoton), "покупка грамм через бота", Math.floor(Date.now() / 1000)],
        );
        await mclient.query("COMMIT");
      } catch (error) {
        await mclient.query("ROLLBACK");
        throw error;
      } finally {
        mclient.release();
      }
      return true;
    },

    async tonSeen(chargeID) {
      const result = await pool.query("SELECT 1 FROM ton_sales WHERE charge_id = $1", [chargeID]);
      return result.rowCount > 0;
    },

    // моя статистика доната: звёзды + нфт-покупки.
    async myStats(tgID) {
      const stars = await pool.query(
        "SELECT COALESCE(SUM(tg_stars), 0) AS tg, COALESCE(SUM(fg_stars), 0) AS fg, COUNT(*) AS n FROM grants WHERE tg_id = $1",
        [String(tgID)],
      );
      const nft = await pool.query(
        "SELECT COALESCE(SUM(tg_stars), 0) AS tg, COUNT(*) AS n FROM nft_sales WHERE tg_id = $1",
        [String(tgID)],
      );
      return {
        starsTG: Number(stars.rows[0].tg),
        starsFG: Number(stars.rows[0].fg),
        starsN: Number(stars.rows[0].n),
        nftTG: Number(nft.rows[0].tg),
        nftN: Number(nft.rows[0].n),
      };
    },

    // топ донатеров за неделю по tg stars (звёзды + нфт).
    async weekTop(limit = 10) {
      const result = await pool.query(
        `SELECT tg_id, SUM(tg_stars) AS total FROM (
           SELECT tg_id, tg_stars FROM grants WHERE created_at > now() - interval '7 days'
           UNION ALL
           SELECT tg_id, tg_stars FROM nft_sales WHERE created_at > now() - interval '7 days'
         ) all_time GROUP BY tg_id ORDER BY total DESC LIMIT $1`,
        [limit],
      );
      return result.rows.map((row) => ({ tgID: Number(row.tg_id), total: Number(row.total) }));
    },
  };
}
