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

type ReportBasis = "actual" | "payroll" | "invoice";

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
  return [fmt(new Date(y, m, 1)), fmt(new Date(y, m + 1, 0))];
}

function recentPeriods(): { label: string; start: string; end: string }[] {
  const periods: { label: string; start: string; end: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthLabel = d.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
    });
    const monthStart = fmt(new Date(y, m, 1));
    const monthMiddle = fmt(new Date(y, m, 15));
    const secondHalfStart = fmt(new Date(y, m, 16));
    const monthEnd = fmt(new Date(y, m + 1, 0));

    periods.push(
      {
        label: `${monthLabel}: 1-15`,
        start: monthStart,
        end: monthMiddle,
      },
      {
        label: `${monthLabel}: 16-end`,
        start: secondHalfStart,
        end: monthEnd,
      },
      {
        label: `${monthLabel}: full month`,
        start: monthStart,
        end: monthEnd,
      },
    );
  }
  return periods;
}

function groupByEmployee(entries: TimeEntryWithDetails[]) {
  const byUser = new Map<
    string,
    {
      name: string;
      byProject: Map<string, { name: string; hours: number }>;
      entries: TimeEntryWithDetails[];
    }
  >();
  for (const e of entries) {
    if (!byUser.has(e.userId))
      byUser.set(e.userId, {
        name: e.user.name,
        byProject: new Map(),
        entries: [],
      });
    const user = byUser.get(e.userId)!;
    if (!user.byProject.has(e.project.id))
      user.byProject.set(e.project.id, { name: e.project.name, hours: 0 });
    user.byProject.get(e.project.id)!.hours += Number(e.hours);
    user.entries.push(e);
  }
  return Array.from(byUser.entries())
    .map(([userId, { name, byProject, entries }]) => {
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
        entries: entries.sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.project.name.localeCompare(b.project.name) ||
            (a.task?.name ?? "").localeCompare(b.task?.name ?? ""),
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function basisLabel(basis: ReportBasis) {
  if (basis === "actual") return "Actual entered time";
  if (basis === "invoice") return "Invoice rounded time";
  return "Payroll rounded time";
}

function basisRoundIncrement(basis: ReportBasis) {
  if (basis === "invoice") return 0.5;
  if (basis === "payroll") return 0.25;
  return null;
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
  const [reportBasis, setReportBasis] = useState<ReportBasis>("payroll");
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
      const params = new URLSearchParams({
        startDate: periodStart,
        endDate: periodEnd,
      });
      const roundIncrement = basisRoundIncrement(reportBasis);
      if (roundIncrement != null) {
        params.set("roundUpIncrementHours", String(roundIncrement));
      }
      const [entriesRes, locksRes] = await Promise.all([
        api<ApiListResponse<TimeEntryWithDetails>>(
          `/time-entries?${params}`,
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
                  <option
                    key={`${p.start}|${p.end}`}
                    value={`${p.start}|${p.end}`}
                  >
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Report basis
              </label>
              <select
                value={reportBasis}
                onChange={(e) => {
                  setReportBasis(e.target.value as ReportBasis);
                  setEntries(null);
                  setLock(null);
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="payroll">Payroll rounded (0.25h)</option>
                <option value="invoice">Invoice rounded (0.5h)</option>
                <option value="actual">Actual entered time</option>
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
                  <span className="ml-2 text-xs">
                    {basisLabel(reportBasis)}
                  </span>
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold tabular-nums">
                    {totalHours.toFixed(2)}h total
                  </p>
                  {reportBasis === "payroll" && (
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
                  )}
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
                        {reportBasis === "payroll" && lock && (
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
                      <details className="border-t border-gray-100 dark:border-gray-700/50">
                        <summary className="cursor-pointer px-5 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                          View {emp.entries.length}{" "}
                          {emp.entries.length === 1 ? "entry" : "entries"}
                        </summary>
                        <div className="overflow-x-auto px-5 pb-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-100 dark:border-gray-700/50 text-gray-500 dark:text-gray-400">
                                <th className="py-2 pr-3 text-left font-medium">
                                  Date
                                </th>
                                <th className="py-2 pr-3 text-left font-medium">
                                  Project
                                </th>
                                <th className="py-2 pr-3 text-left font-medium">
                                  Task
                                </th>
                                <th className="py-2 pr-3 text-left font-medium">
                                  Notes
                                </th>
                                <th className="py-2 text-right font-medium">
                                  Hours
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {emp.entries.map((entry) => (
                                <tr
                                  key={entry.id}
                                  className="border-b border-gray-100 dark:border-gray-700/40 last:border-0"
                                >
                                  <td className="py-2 pr-3 tabular-nums text-gray-600 dark:text-gray-400">
                                    {formatDate(entry.date)}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                                    {entry.project.name}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                                    {entry.task?.name ?? "-"}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                                    {entry.description ?? "-"}
                                  </td>
                                  <td className="py-2 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {Number(entry.hours).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
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
