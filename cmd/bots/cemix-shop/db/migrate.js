import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const done = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
  if (done.rowCount > 0) continue;
  await pool.query(readFileSync(join(dir, name), "utf8"));
  await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
  console.log(`migrated ${name}`);
}
await pool.end();
