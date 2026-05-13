import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { DATABASE_POOL } from "../db/database.module";

export interface HarvestProjectMapping {
  id: string;
  harvestProjectId: string;
  harvestProjectName: string;
  appProjectId: string;
  appProjectName: string | null;
  createdAt: string;
}

// ── Harvest raw types ─────────────────────────────────────────────────────────

interface HarvestUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
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

interface HarvestExpense {
  id: number;
  spent_date: string;
  total_cost: number;
  notes: string | null;
  billable: boolean;
  project: { id: number; name: string };
  expense_category: { id: number; name: string };
  user: { id: number; name: string };
}

// ── Public preview types (returned to frontend) ───────────────────────────────

export interface UserMatch {
  harvestId: number;
  harvestName: string;
  harvestEmail: string;
  appUserId: string | null;
  appUserName: string | null;
  matched: boolean;
}

export interface ProjectMatch {
  harvestId: string;
  appProjectId: string;
  appProjectName: string | null;
}

export interface PreviewTimeEntry {
  harvestId: number;
  date: string;
  hours: number;
  description: string | null;
  billable: boolean;
  harvestProjectId: number;
  harvestProjectName: string;
  harvestTaskName: string;
  harvestUserName: string;
  appProjectId: string | null;
  appUserId: string | null;
  appProjectName: string | null;
  isDuplicate: boolean;
  isMapped: boolean;
}

export interface PreviewExpense {
  harvestId: number;
  date: string;
  totalCents: number;
  notes: string | null;
  harvestProjectId: number;
  harvestProjectName: string;
  categoryName: string;
  harvestUserName: string;
  appProjectId: string | null;
  appUserId: string | null;
  appProjectName: string | null;
  isDuplicate: boolean;
  isMapped: boolean;
}

export interface HarvestPreviewResult {
  configFound: boolean;
  from: string;
  to: string;
  users: UserMatch[];
  projects: ProjectMatch[];
  timeEntries: PreviewTimeEntry[];
  expenses: PreviewExpense[];
  summary: {
    timeTotal: number;
    timeToImport: number;
    timeDuplicates: number;
    timeUnmapped: number;
    expenseTotal: number;
    expenseToImport: number;
    expenseDuplicates: number;
    expenseUnmapped: number;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class HarvestService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  private getCredentials(): { token: string; accountId: string } {
    const token = process.env.HARVEST_TOKEN;
    const accountId = process.env.HARVEST_ACCOUNT_ID;
    if (!token || !accountId) {
      throw new BadRequestException(
        "Harvest credentials not configured. Set HARVEST_TOKEN and HARVEST_ACCOUNT_ID environment variables.",
      );
    }
    return { token, accountId };
  }

  private async getProjectMap(): Promise<Record<string, string>> {
    const { rows } = await this.pool.query<{
      harvest_project_id: string;
      app_project_id: string;
    }>(
      "SELECT harvest_project_id, app_project_id FROM harvest_project_mappings",
    );
    return Object.fromEntries(
      rows.map((r) => [r.harvest_project_id, r.app_project_id]),
    );
  }

  async getStatus(): Promise<{
    credentialsConfigured: boolean;
    mappingCount: number;
  }> {
    const { rows } = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM harvest_project_mappings",
    );
    return {
      credentialsConfigured: !!(
        process.env.HARVEST_TOKEN && process.env.HARVEST_ACCOUNT_ID
      ),
      mappingCount: parseInt(rows[0].count),
    };
  }

  async getMappings(): Promise<HarvestProjectMapping[]> {
    const { rows } = await this.pool.query<{
      id: string;
      harvest_project_id: string;
      harvest_project_name: string;
      app_project_id: string;
      app_project_name: string | null;
      created_at: string;
    }>(
      `SELECT m.id, m.harvest_project_id, m.harvest_project_name, m.app_project_id,
              p.name AS app_project_name, m.created_at
       FROM harvest_project_mappings m
       LEFT JOIN projects p ON p.id = m.app_project_id
       ORDER BY m.created_at`,
    );
    return rows.map((r) => ({
      id: r.id,
      harvestProjectId: r.harvest_project_id,
      harvestProjectName: r.harvest_project_name,
      appProjectId: r.app_project_id,
      appProjectName: r.app_project_name,
      createdAt: r.created_at,
    }));
  }

  async upsertMapping(
    harvestProjectId: string,
    harvestProjectName: string,
    appProjectId: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO harvest_project_mappings (harvest_project_id, harvest_project_name, app_project_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (harvest_project_id) DO UPDATE
         SET harvest_project_name = EXCLUDED.harvest_project_name,
             app_project_id = EXCLUDED.app_project_id`,
      [harvestProjectId, harvestProjectName, appProjectId],
    );
  }

  async deleteMapping(harvestProjectId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM harvest_project_mappings WHERE harvest_project_id = $1",
      [harvestProjectId],
    );
  }

  async getHarvestProjects(): Promise<Array<{ id: number; name: string }>> {
    const { token, accountId } = this.getCredentials();
    const projects = await this.fetchAll<{ id: number; name: string }>(
      "/projects",
      token,
      accountId,
    );
    return projects.map((p) => ({ id: p.id, name: p.name }));
  }

  private async fetchAll<T>(
    path: string,
    token: string,
    accountId: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const qs = new URLSearchParams({
        page: String(page),
        per_page: "100",
        ...params,
      });
      const url = `https://api.harvestapp.com/v2${path}?${qs}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Harvest-Account-Id": accountId,
          "User-Agent": "Interface-Environmental/1.0",
        },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new BadRequestException(
          `Harvest API error ${res.status}: ${body}`,
        );
      }

      const json = (await res.json()) as Record<string, unknown>;
      const key = Object.keys(json).find(
        (k) => Array.isArray(json[k]) && k !== "links",
      );
      if (!key) break;

      const items = json[key] as T[];
      results.push(...items);

      const totalPages = (json["total_pages"] as number) ?? 1;
      if (page >= totalPages) break;
      page++;
    }

    return results;
  }

  async preview(from: string, to: string): Promise<HarvestPreviewResult> {
    const { token, accountId } = this.getCredentials();
    const projectMap = await this.getProjectMap();

    // ── Fetch from Harvest ────────────────────────────────────────────────
    const [harvestUsers, harvestTimeEntries, harvestExpenses] =
      await Promise.all([
        this.fetchAll<HarvestUser>("/users", token, accountId),
        this.fetchAll<HarvestTimeEntry>("/time_entries", token, accountId, {
          from,
          to,
        }),
        this.fetchAll<HarvestExpense>("/expenses", token, accountId, {
          from,
          to,
        }),
      ]);

    // ── Fetch app data ────────────────────────────────────────────────────
    const { rows: appUsers } = await this.pool.query<{
      id: string;
      email: string;
      name: string;
    }>("SELECT id, email, name FROM users");

    const { rows: appProjects } = await this.pool.query<{
      id: string;
      name: string;
    }>("SELECT id, name FROM projects");

    const appUserByEmail = new Map(
      appUsers.map((u) => [u.email.toLowerCase(), u]),
    );
    const appProjectById = new Map(appProjects.map((p) => [p.id, p]));

    // ── User map ──────────────────────────────────────────────────────────
    const userMap = new Map<number, string>(); // harvestId → appUserId
    const users: UserMatch[] = harvestUsers.map((hu) => {
      const appUser = appUserByEmail.get(hu.email.toLowerCase());
      if (appUser) userMap.set(hu.id, appUser.id);
      return {
        harvestId: hu.id,
        harvestName: `${hu.first_name} ${hu.last_name}`,
        harvestEmail: hu.email,
        appUserId: appUser?.id ?? null,
        appUserName: appUser?.name ?? null,
        matched: !!appUser,
      };
    });

    // ── Project map ───────────────────────────────────────────────────────
    const projects: ProjectMatch[] = Object.entries(projectMap).map(
      ([harvestId, appId]) => ({
        harvestId,
        appProjectId: appId,
        appProjectName: appProjectById.get(appId)?.name ?? null,
      }),
    );

    // ── Existing time entries for dedup ───────────────────────────────────
    const { rows: existingTE } = await this.pool.query<{
      project_id: string;
      user_id: string;
      date: string;
      hours: string;
      description: string | null;
    }>(
      `SELECT project_id, user_id, date::text, hours::text, description
       FROM time_entries`,
    );
    const teKey = (
      pId: string,
      uId: string,
      date: string,
      hours: number,
      desc: string | null,
    ) => `${pId}|${uId}|${date}|${Number(hours).toFixed(2)}|${desc ?? ""}`;
    const existingTESet = new Set(
      existingTE.map((r) =>
        teKey(
          r.project_id,
          r.user_id,
          r.date.slice(0, 10),
          parseFloat(r.hours),
          r.description,
        ),
      ),
    );

    // ── Existing expenses for dedup ───────────────────────────────────────
    // We need project_expense names too for dedup key
    const { rows: existingExp } = await this.pool.query<{
      project_id: string;
      user_id: string;
      date: string;
      total_cents: string;
      name: string;
    }>(
      `SELECT ue.project_id, ue.user_id, ue.date::text, ue.total_cents::text,
              COALESCE(pe.name, '') AS name
       FROM user_expenses ue
       JOIN project_expenses pe ON pe.id = ue.project_expense_id`,
    );
    const expKey = (
      pId: string,
      uId: string,
      date: string,
      cents: number,
      name: string,
    ) => `${pId}|${uId}|${date}|${cents}|${name}`;
    const existingExpSet = new Set(
      existingExp.map((r) =>
        expKey(
          r.project_id,
          r.user_id,
          r.date.slice(0, 10),
          parseInt(r.total_cents),
          r.name,
        ),
      ),
    );

    // ── Build preview time entries ────────────────────────────────────────
    const timeEntries: PreviewTimeEntry[] = harvestTimeEntries.map((te) => {
      const appProjectId = projectMap[String(te.project.id)] ?? null;
      const appUserId = userMap.get(te.user.id) ?? null;
      const appProject = appProjectId ? appProjectById.get(appProjectId) : null;
      const isMapped = !!appProjectId && !!appUserId;
      const isDuplicate = isMapped
        ? existingTESet.has(
            teKey(
              appProjectId!,
              appUserId!,
              te.spent_date,
              te.hours,
              te.notes ?? null,
            ),
          )
        : false;

      return {
        harvestId: te.id,
        date: te.spent_date,
        hours: te.hours,
        description: te.notes,
        billable: te.billable,
        harvestProjectId: te.project.id,
        harvestProjectName: te.project.name,
        harvestTaskName: te.task.name,
        harvestUserName: te.user.name,
        appProjectId,
        appUserId,
        appProjectName: appProject?.name ?? null,
        isDuplicate,
        isMapped,
      };
    });

    // ── Build preview expenses ────────────────────────────────────────────
    const expenses: PreviewExpense[] = harvestExpenses.map((exp) => {
      const appProjectId = projectMap[String(exp.project.id)] ?? null;
      const appUserId = userMap.get(exp.user.id) ?? null;
      const appProject = appProjectId ? appProjectById.get(appProjectId) : null;
      const isMapped = !!appProjectId && !!appUserId;
      const totalCents = Math.round(exp.total_cost * 100);
      const isDuplicate = isMapped
        ? existingExpSet.has(
            expKey(
              appProjectId!,
              appUserId!,
              exp.spent_date,
              totalCents,
              exp.expense_category.name,
            ),
          )
        : false;

      return {
        harvestId: exp.id,
        date: exp.spent_date,
        totalCents,
        notes: exp.notes,
        harvestProjectId: exp.project.id,
        harvestProjectName: exp.project.name,
        categoryName: exp.expense_category.name,
        harvestUserName: exp.user.name,
        appProjectId,
        appUserId,
        appProjectName: appProject?.name ?? null,
        isDuplicate,
        isMapped,
      };
    });

    // ── Summary ───────────────────────────────────────────────────────────
    const summary = {
      timeTotal: timeEntries.length,
      timeToImport: timeEntries.filter((t) => t.isMapped && !t.isDuplicate)
        .length,
      timeDuplicates: timeEntries.filter((t) => t.isDuplicate).length,
      timeUnmapped: timeEntries.filter((t) => !t.isMapped).length,
      expenseTotal: expenses.length,
      expenseToImport: expenses.filter((e) => e.isMapped && !e.isDuplicate)
        .length,
      expenseDuplicates: expenses.filter((e) => e.isDuplicate).length,
      expenseUnmapped: expenses.filter((e) => !e.isMapped).length,
    };

    return {
      configFound: true,
      from,
      to,
      users,
      projects,
      timeEntries,
      expenses,
      summary,
    };
  }

  async runImport(
    from: string,
    to: string,
  ): Promise<{ timeInserted: number; expensesInserted: number }> {
    const { token, accountId } = this.getCredentials();
    const projectMap = await this.getProjectMap();

    const [harvestUsers, harvestTimeEntries, harvestExpenses] =
      await Promise.all([
        this.fetchAll<HarvestUser>("/users", token, accountId),
        this.fetchAll<HarvestTimeEntry>("/time_entries", token, accountId, {
          from,
          to,
        }),
        this.fetchAll<HarvestExpense>("/expenses", token, accountId, {
          from,
          to,
        }),
      ]);

    const { rows: appUsers } = await this.pool.query<{
      id: string;
      email: string;
    }>("SELECT id, email FROM users");
    const appUserByEmail = new Map(
      appUsers.map((u) => [u.email.toLowerCase(), u]),
    );
    const userMap = new Map<number, string>();
    for (const hu of harvestUsers) {
      const au = appUserByEmail.get(hu.email.toLowerCase());
      if (au) userMap.set(hu.id, au.id);
    }

    // Task cache: "projectUUID:taskName" → taskUUID
    const taskMap = new Map<string, string>();
    const getOrCreateTask = async (
      projectId: string,
      taskName: string,
    ): Promise<string> => {
      const key = `${projectId}:${taskName}`;
      if (taskMap.has(key)) return taskMap.get(key)!;
      const { rows } = await this.pool.query<{ id: string }>(
        "SELECT id FROM tasks WHERE project_id = $1 AND name = $2 LIMIT 1",
        [projectId, taskName],
      );
      if (rows[0]) {
        taskMap.set(key, rows[0].id);
        return rows[0].id;
      }
      const id = uuid();
      await this.pool.query(
        "INSERT INTO tasks (id, project_id, name) VALUES ($1, $2, $3)",
        [id, projectId, taskName],
      );
      taskMap.set(key, id);
      return id;
    };

    // Project expense cache: "projectUUID:categoryName" → projectExpenseUUID
    const peMap = new Map<string, string>();
    const getOrCreatePE = async (
      projectId: string,
      name: string,
    ): Promise<string> => {
      const key = `${projectId}:${name}`;
      if (peMap.has(key)) return peMap.get(key)!;
      const { rows } = await this.pool.query<{ id: string }>(
        "SELECT id FROM project_expenses WHERE project_id = $1 AND name = $2 AND expense_id IS NULL LIMIT 1",
        [projectId, name],
      );
      if (rows[0]) {
        peMap.set(key, rows[0].id);
        return rows[0].id;
      }
      const id = uuid();
      await this.pool.query(
        "INSERT INTO project_expenses (id, project_id, expense_id, name, type, rate_cents) VALUES ($1, $2, NULL, $3, 'dollar', 0)",
        [id, projectId, name],
      );
      peMap.set(key, id);
      return id;
    };

    let timeInserted = 0;
    for (const te of harvestTimeEntries) {
      const projectId = projectMap[String(te.project.id)];
      const appUserId = userMap.get(te.user.id);
      if (!projectId || !appUserId) continue;

      const { rows: dup } = await this.pool.query(
        `SELECT id FROM time_entries WHERE project_id=$1 AND user_id=$2 AND date=$3 AND hours=$4
         AND (description=$5 OR (description IS NULL AND $5 IS NULL))`,
        [projectId, appUserId, te.spent_date, te.hours, te.notes ?? null],
      );
      if (dup.length > 0) continue;

      const taskId = await getOrCreateTask(projectId, te.task.name);
      await this.pool.query(
        "INSERT INTO time_entries (id, project_id, user_id, task_id, date, hours, description, billable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
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
      timeInserted++;
    }

    let expensesInserted = 0;
    for (const exp of harvestExpenses) {
      const projectId = projectMap[String(exp.project.id)];
      const appUserId = userMap.get(exp.user.id);
      if (!projectId || !appUserId) continue;

      const peId = await getOrCreatePE(projectId, exp.expense_category.name);
      const totalCents = Math.round(exp.total_cost * 100);

      const { rows: dup } = await this.pool.query(
        "SELECT id FROM user_expenses WHERE project_id=$1 AND user_id=$2 AND project_expense_id=$3 AND date=$4 AND total_cents=$5",
        [projectId, appUserId, peId, exp.spent_date, totalCents],
      );
      if (dup.length > 0) continue;

      await this.pool.query(
        "INSERT INTO user_expenses (id, project_id, user_id, project_expense_id, date, quantity, total_cents, notes) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7)",
        [
          uuid(),
          projectId,
          appUserId,
          peId,
          exp.spent_date,
          totalCents,
          exp.notes ?? null,
        ],
      );
      expensesInserted++;
    }

    return { timeInserted, expensesInserted };
  }
}
