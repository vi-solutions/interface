import { config } from "dotenv";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

config({ path: join(__dirname, "..", "..", "..", "..", ".env") });

async function migrate() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/interface_env",
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: applied } = await pool.query("SELECT name FROM _migrations");
  const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`  apply: ${file}`);
    await pool.query(sql);
    await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
  }

  console.log("Migrations complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
