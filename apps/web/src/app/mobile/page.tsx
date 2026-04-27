"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import type {
  ApiListResponse,
  TimeEntryWithDetails,
  UserExpenseWithDetails,
} from "@interface/shared";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function weekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

export default function MobileDashboard() {
  const { authenticated, user } = useRequireAuth();
  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);
  const [expenses, setExpenses] = useState<UserExpenseWithDetails[]>([]);

  useEffect(() => {
    if (!authenticated || !user) return;
    const ws = weekStart();
    const ms = monthStart();
    const td = today();

    api<ApiListResponse<TimeEntryWithDetails>>(
      `/time-entries?userId=${user.id}&startDate=${ms}&endDate=${td}`,
    )
      .then((r) => setEntries(r.data))
      .catch(() => {});

    api<ApiListResponse<UserExpenseWithDetails>>(
      `/user-expenses?userId=${user.id}`,
    )
      .then((r) => setExpenses(r.data))
      .catch(() => {});
  }, [authenticated, user]);

  if (!authenticated || !user) return null;

  const ws = weekStart();
  const ms = monthStart();
  const td = today();

  const weekEntries = entries.filter((e) => e.date >= ws && e.date <= td);
  const monthEntries = entries; // already filtered to month range
  const weekHours = weekEntries.reduce((s, e) => s + Number(e.hours), 0);
  const monthHours = monthEntries.reduce((s, e) => s + Number(e.hours), 0);

  const monthExpenses = expenses.filter((e) => e.date >= ms && e.date <= td);
  const expenseTotalCents = monthExpenses.reduce(
    (s, e) => s + Number(e.totalCents),
    0,
  );

  // Group month entries by project
  const byProject = monthEntries.reduce<
    Record<string, { name: string; hours: number }>
  >((acc, e) => {
    if (!acc[e.projectId])
      acc[e.projectId] = { name: e.project.name, hours: 0 };
    acc[e.projectId].hours += Number(e.hours);
    return acc;
  }, {});
  const projectBreakdown = Object.entries(byProject)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.hours - a.hours);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="px-4 pt-8 pb-4">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{greeting}</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {user.name.split(" ")[0]}
        </h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl bg-emerald-500 p-4 text-white">
          <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
            This Week
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {fmtHours(weekHours)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            This Month
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {fmtHours(monthHours)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Expenses
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            ${(expenseTotalCents / 100).toFixed(0)}
          </p>
        </div>
      </div>

      {/* Time by Project */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          This Month by Project
        </h2>
      </div>

      {projectBreakdown.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
          No time logged this month.
        </div>
      )}

      {projectBreakdown.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
          {projectBreakdown.map((p) => {
            const pct = monthHours > 0 ? (p.hours / monthHours) * 100 : 0;
            return (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-3">
                    {p.name}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                    {fmtHours(p.hours)}
                  </p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
