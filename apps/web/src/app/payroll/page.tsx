"use client";

import { useState } from "react";
import type { ApiListResponse, TimeEntryWithDetails } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button, Card } from "@/components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  for (let i = 0; i < 24; i++) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth() - Math.floor(i / 2),
      1,
    );
    const y = d.getFullYear();
    const m = d.getMonth();
    const isFirst = i % 2 === 0;
    const start = isFirst ? fmt(new Date(y, m, 1)) : fmt(new Date(y, m, 16));
    const end = isFirst ? fmt(new Date(y, m, 15)) : fmt(new Date(y, m + 1, 0));
    const monthLabel = d.toLocaleDateString("en-CA", {
      month: "short",
      year: "numeric",
    });
    periods.push({
      label: isFirst ? `${monthLabel} 1–15` : `${monthLabel} 16–end`,
      start,
      end,
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

// ── component ─────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { authenticated } = useRequireAuth();

  const [periodStart, setPeriodStart] = useState(currentPeriod()[0]);
  const [periodEnd, setPeriodEnd] = useState(currentPeriod()[1]);
  const [entries, setEntries] = useState<TimeEntryWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = recentPeriods();

  if (!authenticated) return null;

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiListResponse<TimeEntryWithDetails>>(
        `/time-entries?startDate=${periodStart}&endDate=${periodEnd}`,
      );
      setEntries(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries");
    } finally {
      setLoading(false);
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
                <p className="text-sm font-semibold tabular-nums">
                  {totalHours.toFixed(2)}h total
                </p>
              </div>

              <div className="space-y-4">
                {grouped.map((emp) => (
                  <Card
                    key={emp.userId}
                    padding={false}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                      <span className="font-semibold text-sm">{emp.name}</span>
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
