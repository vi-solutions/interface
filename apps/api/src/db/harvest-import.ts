/**
 * harvest-import.ts
 *
 * One-time migration of Harvest time entries and expenses into the app DB.
 *
 * Setup:
 *   1. Fill in /harvest-config.json at the repo root with your token, account
 *      ID, and project ID mappings (Harvest project ID → app project UUID).
 *   2. npm run db:harvest-import --workspace=apps/api
 *      Or for a dry run: DRY_RUN=true npm run db:harvest-import --workspace=apps/api
 *
 * Behaviour:
 *   - Users are matched by email (Harvest → app). Unmatched users are skipped
 *     with a warning.
 *   - Tasks are created for each unique Harvest task name found on a project.
 *     Re-running is safe — existing tasks are looked up by (project_id, name).
 *   - Time entries are deduplicated by (project_id, user_id, date, hours,
 *     description). Re-running won't create duplicates.
 *   - For expenses: a `project_expenses` row is created per Harvest expense
 *     category per project (idempotent by name). Then `user_expenses` are
 *     deduplicated by (project_id, user_id, project_expense_id, date,
 *     total_cents).
 */

import { config } from "dotenv";
import { join } from "path";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";

config({ path: join(__dirname, "..", "..", "..", "..", ".env") });

interface HarvestUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

interface HarvestTimeEntry {
  id: number;
  spent_date: string;
  hours: number;
  notes: string | null;
  billable: boolean;
  project: { id: number; name: string };
  task: { id: number; name: string };
  user: { id: number; name: string };
}

interface HarvestExpenseCategory {
  id: number;
  name: string;
  is_active: boolean;
}

interface HarvestExpense {
  id: number;
  spent_date: string;
  total_cost: number;
  notes: string | null;
  billable: boolean;
  project: { id: number; name: string };
  expense_category: { id: number; name: string };
  user: { id: number; name: string };
  receipt: { url: string; file_name: string } | null;
}

// ── Harvest API client ────────────────────────────────────────────────────────

async function harvestFetch<T>(
  path: string,
  token: string,
  accountId: string,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.harvestapp.com/v2${path}?page=${page}&per_page=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Harvest-Account-Id": accountId,
        "User-Agent": "Interface-Environmental-Import/1.0",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Harvest API error ${res.status} for ${path}: ${body}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    // Harvest wraps results in a key matching the resource name
    const resourceKey = Object.keys(json).find(
      (k) => Array.isArray(json[k]) && k !== "links",
    );
    if (!resourceKey) break;

    const page_results = json[resourceKey] as T[];
    results.push(...page_results);

    const totalPages = (json["total_pages"] as number) ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dollars(amount: number): number {
  return Math.round(amount * 100);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

function warn(msg: string) {
  console.warn(`  ⚠  ${msg}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const DRY_RUN = process.env.DRY_RUN === "true";
  if (DRY_RUN) console.log("\n[DRY RUN — no writes will occur]\n");

  const token = process.env.HARVEST_TOKEN;
  const accountId = process.env.HARVEST_ACCOUNT_ID;
  if (!token || !accountId) {
    throw new Error(
      "HARVEST_TOKEN and HARVEST_ACCOUNT_ID environment variables must be set.",
    );
  }

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/interface_env",
  });

  try {
    // ── 0. Load project map from DB ───────────────────────────────────────────
    const { rows: mappingRows } = await pool.query<{
      harvest_project_id: string;
      app_project_id: string;
    }>(
      "SELECT harvest_project_id, app_project_id FROM harvest_project_mappings",
    );
    const projectMap: Record<string, string> = Object.fromEntries(
      mappingRows.map((r) => [r.harvest_project_id, r.app_project_id]),
    );
    log(`Loaded ${mappingRows.length} project mappings from DB`);

    // ── 1. Build user map: Harvest user ID → app user UUID ──────────────────────
    console.log(
      "\n── Users ────────────────────────────────────────────────────────────",
    );
    const harvestUsers = await harvestFetch<HarvestUser>(
      "/users",
      token,
      accountId,
    );
    log(`Fetched ${harvestUsers.length} Harvest users`);

    const { rows: appUsers } = await pool.query<{
      id: string;
      email: string;
      name: string;
    }>("SELECT id, email, name FROM users");

    const appUserByEmail = new Map(
      appUsers.map((u) => [u.email.toLowerCase(), u]),
    );

    const userMap = new Map<number, string>(); // harvestUserId → appUserId
    for (const hu of harvestUsers) {
      const appUser = appUserByEmail.get(hu.email.toLowerCase());
      if (appUser) {
        userMap.set(hu.id, appUser.id);
        log(`  ${hu.first_name} ${hu.last_name} <${hu.email}> → matched`);
      } else {
        warn(
          `${hu.first_name} ${hu.last_name} <${hu.email}> — no app user found, will skip their entries`,
        );
      }
    }

    // ── 2. Time entries ─────────────────────────────────────────────────────
    console.log(
      "\n── Time Entries ───────────────────────────────────────────",
    );
    const timeEntries = await harvestFetch<HarvestTimeEntry>(
      "/time_entries",
      token,
      accountId,
    );
    log(`Fetched ${timeEntries.length} time entries from Harvest`);

    // task map: "projectUUID:taskName" → task UUID
    const taskMap = new Map<string, string>();

    const getOrCreateTask = async (
      projectId: string,
      taskName: string,
    ): Promise<string> => {
      const key = `${projectId}:${taskName}`;
      if (taskMap.has(key)) return taskMap.get(key)!;

      const { rows } = await pool.query<{ id: string }>(
        "SELECT id FROM tasks WHERE project_id = $1 AND name = $2 LIMIT 1",
        [projectId, taskName],
      );
      if (rows[0]) {
        taskMap.set(key, rows[0].id);
        return rows[0].id;
      }

      const newId = uuid();
      if (!DRY_RUN) {
        await pool.query(
          "INSERT INTO tasks (id, project_id, name) VALUES ($1, $2, $3)",
          [newId, projectId, taskName],
        );
      }
      taskMap.set(key, newId);
      log(`  Created task "${taskName}" on project ${projectId}`);
      return newId;
    };

    let teInserted = 0;
    let teSkipped = 0;
    let teMissing = 0;

    for (const te of timeEntries) {
      const projectId = projectMap[String(te.project.id)];
      if (!projectId) {
        teMissing++;
        continue;
      }

      const appUserId = userMap.get(te.user.id);
      if (!appUserId) {
        teMissing++;
        continue;
      }

      const taskId = await getOrCreateTask(projectId, te.task.name);

      // Idempotency check
      const { rows: existing } = await pool.query(
        `SELECT id FROM time_entries
         WHERE project_id = $1 AND user_id = $2 AND date = $3
           AND hours = $4 AND (description = $5 OR (description IS NULL AND $5 IS NULL))`,
        [projectId, appUserId, te.spent_date, te.hours, te.notes ?? null],
      );

      if (existing.length > 0) {
        teSkipped++;
        continue;
      }

      if (!DRY_RUN) {
        await pool.query(
          `INSERT INTO time_entries
             (id, project_id, user_id, task_id, date, hours, description, billable)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            uuid(),
            projectId,
            appUserId,
            taskId,
            te.spent_date,
            te.hours,
            te.notes ?? null,
            te.billable,
          ],
        );
      }
      teInserted++;
    }

    log(
      `  Inserted: ${teInserted}  |  Skipped (duplicate): ${teSkipped}  |  Skipped (no mapping): ${teMissing}`,
    );

    // ── 3. Expenses ─────────────────────────────────────────────────────────
    console.log(
      "\n── Expenses ───────────────────────────────────────────────",
    );
    const expenses = await harvestFetch<HarvestExpense>(
      "/expenses",
      token,
      accountId,
    );
    log(`Fetched ${expenses.length} expenses from Harvest`);

    // project_expense map: "projectUUID:categoryName" → project_expense UUID
    const projectExpenseMap = new Map<string, string>();

    const getOrCreateProjectExpense = async (
      projectId: string,
      categoryName: string,
    ): Promise<string> => {
      const key = `${projectId}:${categoryName}`;
      if (projectExpenseMap.has(key)) return projectExpenseMap.get(key)!;

      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM project_expenses
         WHERE project_id = $1 AND name = $2 AND expense_id IS NULL LIMIT 1`,
        [projectId, categoryName],
      );
      if (rows[0]) {
        projectExpenseMap.set(key, rows[0].id);
        return rows[0].id;
      }

      const newId = uuid();
      if (!DRY_RUN) {
        await pool.query(
          `INSERT INTO project_expenses (id, project_id, expense_id, name, type, rate_cents)
           VALUES ($1, $2, NULL, $3, 'dollar', 0)`,
          [newId, projectId, categoryName],
        );
      }
      projectExpenseMap.set(key, newId);
      log(
        `  Created project_expense "${categoryName}" on project ${projectId}`,
      );
      return newId;
    };

    let expInserted = 0;
    let expSkipped = 0;
    let expMissing = 0;

    for (const exp of expenses) {
      const projectId = projectMap[String(exp.project.id)];
      if (!projectId) {
        expMissing++;
        continue;
      }

      const appUserId = userMap.get(exp.user.id);
      if (!appUserId) {
        expMissing++;
        continue;
      }

      const projectExpenseId = await getOrCreateProjectExpense(
        projectId,
        exp.expense_category.name,
      );
      const totalCents = dollars(exp.total_cost);

      // Idempotency check
      const { rows: existing } = await pool.query(
        `SELECT id FROM user_expenses
         WHERE project_id = $1 AND user_id = $2
           AND project_expense_id = $3 AND date = $4 AND total_cents = $5`,
        [projectId, appUserId, projectExpenseId, exp.spent_date, totalCents],
      );

      if (existing.length > 0) {
        expSkipped++;
        continue;
      }

      if (!DRY_RUN) {
        await pool.query(
          `INSERT INTO user_expenses
             (id, project_id, user_id, project_expense_id, date, quantity, total_cents, notes)
           VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)`,
          [
            uuid(),
            projectId,
            appUserId,
            projectExpenseId,
            exp.spent_date,
            totalCents,
            exp.notes ?? null,
          ],
        );
      }
      expInserted++;
    }

    log(
      `  Inserted: ${expInserted}  |  Skipped (duplicate): ${expSkipped}  |  Skipped (no mapping): ${expMissing}`,
    );

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(
      "\n── Summary ────────────────────────────────────────────────",
    );
    if (DRY_RUN) {
      log("Dry run complete — no data was written.");
    } else {
      log(`Time entries inserted: ${teInserted}`);
      log(`Expenses inserted:     ${expInserted}`);
      log("Import complete.");
    }

    if (teMissing > 0 || expMissing > 0) {
      console.log(
        "\n  Entries were skipped due to missing project or user mappings.",
        "\n  Check that all Harvest project IDs are mapped in the integrations page",
        "\n  and that all Harvest user emails exist as app users.",
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nImport failed:", err.message);
  process.exit(1);
});
