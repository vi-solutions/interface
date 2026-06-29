"use client";

import { useState, useEffect } from "react";
import type {
  ApiListResponse,
  PayPeriodLock,
  TimeEntryWithDetails,
} from "@interface/shared";
import { api } from "@/lib/api";
import { dateToDateInputValue, formatDateString } from "@/lib/dates";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button, Card } from "@/components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return dateToDateInputValue(d);
}

function formatDate(iso: string) {
  return formatDateString(
    iso,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    "en-CA",
  );
}

function currentPeriod(): [string, string] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  if (d <= 15) {
    return [fmt(new Date(y, m, 1)), fmt(new Date(y, m, 15))];
  } else {
    return [fmt(new Date(y, m, 16)), fmt(new Date(y, m + 1, 0))];
  }
}

function recentPeriods(): { label: string; start: string; end: string }[] {
  const periods: { label: string; start: string; end: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthLabel = d.toLocaleDateString("en-CA", {
      month: "short",
      year: "numeric",
    });
    periods.push({
      label: `${monthLabel} 16–end`,
      start: fmt(new Date(y, m, 16)),
      end: fmt(new Date(y, m + 1, 0)),
    });
    periods.push({
      label: `${monthLabel} 1–15`,
      start: fmt(new Date(y, m, 1)),
      end: fmt(new Date(y, m, 15)),
    });
  }
  return periods;
}

function groupByEmployee(entries: TimeEntryWithDetails[]) {
  const byUser = new Map<
    string,
    {
      name: string;
      byProject: Map<string, { name: string; hours: number }>;
    }
  >();
  for (const e of entries) {
    if (!byUser.has(e.userId))
      byUser.set(e.userId, { name: e.user.name, byProject: new Map() });
    const user = byUser.get(e.userId)!;
    if (!user.byProject.has(e.project.id))
      user.byProject.set(e.project.id, { name: e.project.name, hours: 0 });
    user.byProject.get(e.project.id)!.hours += Number(e.hours);
  }
  return Array.from(byUser.entries())
    .map(([userId, { name, byProject }]) => {
      const projects = Array.from(byProject.entries())
        .map(([projectId, { name: pName, hours }]) => ({
          projectId,
          name: pName,
          hours,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        userId,
        name,
        totalHours: projects.reduce((s, p) => s + p.hours, 0),
        projects,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function exportCsv(
  grouped: ReturnType<typeof groupByEmployee>,
  periodStart: string,
  periodEnd: string,
) {
  const rows: string[][] = [["Employee", "Project", "Hours"]];
  for (const emp of grouped) {
    for (const proj of emp.projects) {
      rows.push([emp.name, proj.name, proj.hours.toFixed(2)]);
    }
    rows.push([emp.name, "TOTAL", emp.totalHours.toFixed(2)]);
    rows.push([]);
  }
  const csv = rows
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-${periodStart}-${periodEnd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [periodStart, setPeriodStart] = useState(currentPeriod()[0]);
  const [periodEnd, setPeriodEnd] = useState(currentPeriod()[1]);
  const [entries, setEntries] = useState<TimeEntryWithDetails[] | null>(null);
  const [lock, setLock] = useState<PayPeriodLock | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = recentPeriods();

  useEffect(() => {
    if (!authenticated) return;
    if (currentUser && !currentUser.isAdmin) {
      router.push("/");
    }
  }, [authenticated, currentUser, router]);

  if (!authenticated || !currentUser?.isAdmin) return null;

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const [entriesRes, locksRes] = await Promise.all([
        api<ApiListResponse<TimeEntryWithDetails>>(
          `/time-entries?startDate=${periodStart}&endDate=${periodEnd}&roundUpIncrementHours=0.25`,
        ),
        api<ApiListResponse<PayPeriodLock>>(
          `/pay-period-locks?periodStart=${periodStart}&periodEnd=${periodEnd}`,
        ),
      ]);
      setEntries(entriesRes.data);
      setLock(locksRes.data[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }

  async function lockPeriod() {
    setLockLoading(true);
    setError(null);
    try {
      const res = await api<ApiListResponse<PayPeriodLock>>(
        "/pay-period-locks",
        {
          method: "POST",
          body: JSON.stringify({ periodStart, periodEnd }),
        },
      );
      setLock(res.data[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to lock period");
    } finally {
      setLockLoading(false);
    }
  }

  async function unlockPeriod(lockId: string) {
    setLockLoading(true);
    setError(null);
    try {
      await api(`/pay-period-locks/${lockId}`, { method: "DELETE" });
      setLock(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unlock period");
    } finally {
      setLockLoading(false);
    }
  }

  const grouped = entries ? groupByEmployee(entries) : [];
  const totalHours = entries
    ? entries.reduce((s, e) => s + Number(e.hours), 0)
    : 0;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <PageHeader title="Payroll" subtitle="View hours by pay period" />

        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Pay period
              </label>
              <select
                value={`${periodStart}|${periodEnd}`}
                onChange={(e) => {
                  const [s, end] = e.target.value.split("|");
                  setPeriodStart(s);
                  setPeriodEnd(end);
                  setEntries(null);
                  setLock(null);
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {periods.map((p) => (
                  <option key={p.start} value={`${p.start}|${p.end}`}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleLoad} disabled={loading}>
              {loading ? "Loading…" : "Load"}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </Card>

        {entries !== null &&
          (entries.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No time entries for this period.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(periodStart)} – {formatDate(periodEnd)}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold tabular-nums">
                    {totalHours.toFixed(2)}h total
                  </p>
                  <Button
                    variant="secondary"
                    disabled={lockLoading}
                    onClick={() =>
                      lock ? unlockPeriod(lock.id) : lockPeriod()
                    }
                  >
                    {lockLoading
                      ? lock
                        ? "Unlocking..."
                        : "Locking..."
                      : lock
                        ? "Unlock period"
                        : "Lock period"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => exportCsv(grouped, periodStart, periodEnd)}
                  >
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {grouped.map((emp) => (
                  <Card
                    key={emp.userId}
                    padding={false}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">
                          {emp.name}
                        </span>
                        {lock && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Period locked
                          </span>
                        )}
                      </div>
                      <span className="text-sm tabular-nums font-semibold">
                        {emp.totalHours.toFixed(2)}h
                      </span>
                    </div>
                    <div>
                      {emp.projects.map((proj) => (
                        <div
                          key={proj.projectId}
                          className="flex items-center justify-between px-5 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {proj.name}
                          </span>
                          <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                            {proj.hours.toFixed(2)}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ))}
      </div>
    </AppShell>
  );
}
