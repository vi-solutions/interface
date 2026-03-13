import { config } from "dotenv";
import { join } from "path";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";

config({ path: join(__dirname, "..", "..", "..", "..", ".env") });

async function seed() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/interface_env",
  });

  console.log("Seeding database...");

  // Seed a demo user with password "admin123"
  const passwordHash = await bcrypt.hash("admin123", 10);
  await pool.query(
    `INSERT INTO users (id, email, name, role, password_hash)
     VALUES ('00000000-0000-0000-0000-000000000001', 'admin@interfaceenv.com', 'Admin User', 'admin', $1)
     ON CONFLICT (email) DO UPDATE SET password_hash = $1`,
    [passwordHash],
  );

  // Seed a demo client
  await pool.query(`
    INSERT INTO clients (id, name, contact_name, contact_email)
    VALUES ('00000000-0000-0000-0000-000000000010', 'City of Portland', 'Jane Smith', 'jsmith@portland.gov')
    ON CONFLICT DO NOTHING
  `);

  // Seed a demo project
  await pool.query(`
    INSERT INTO projects (id, client_id, name, description, status, phase)
    VALUES (
      '00000000-0000-0000-0000-000000000100',
      '00000000-0000-0000-0000-000000000010',
      'Wetland Delineation - Johnson Creek',
      'Phase 1 wetland assessment and delineation for Johnson Creek restoration corridor.',
      'active',
      'assessment'
    )
    ON CONFLICT DO NOTHING
  `);

  console.log("Seeding complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
