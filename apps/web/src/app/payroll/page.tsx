"use client";

import { useState } from "react";
import type { ApiListResponse, TimeEntryWithDetails } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button, Card } from "@/components/ui";

// Payroll CSV columns
const CSV_HEADERS = [
  "Employee Name",
  "Date",
  "Hours",
  "Project",
  "Description",
];

function toCSV(entries: TimeEntryWithDetails[]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = entries.map((e) =>
    [
      e.user.name,
      e.date,
      Number(e.hours).toFixed(2),
      e.project.name,
      e.description ?? "",
    ]
      .map(escape)
      .join(","),
  );

  return [CSV_HEADERS.join(","), ...rows].join("\r\n");
}

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Summarise hours by employee for the preview table
function summariseByEmployee(
  entries: TimeEntryWithDetails[],
): { name: string; totalHours: number; entryCount: number }[] {
  const map = new Map<
    string,
    { name: string; totalHours: number; entryCount: number }
  >();
  for (const e of entries) {
    const existing = map.get(e.userId);
    if (existing) {
      existing.totalHours += Number(e.hours);
      existing.entryCount += 1;
    } else {
      map.set(e.userId, {
        name: e.user.name,
        totalHours: Number(e.hours),
        entryCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function PayrollPage() {
  const { authenticated } = useRequireAuth();

  // Default pay period: first of current month → today
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(fmt(firstOfMonth));
  const [endDate, setEndDate] = useState(fmt(today));
  const [entries, setEntries] = useState<TimeEntryWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authenticated) return null;

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiListResponse<TimeEntryWithDetails>>(
        `/time-entries?startDate=${startDate}&endDate=${endDate}`,
      );
      setEntries(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!entries?.length) return;
    const csv = toCSV(entries);
    const filename = `payroll-hours-${startDate}-to-${endDate}.csv`;
    downloadCSV(csv, filename);
  }

  const summary = entries ? summariseByEmployee(entries) : null;
  const totalHours = entries
    ? entries.reduce((sum, e) => sum + Number(e.hours), 0)
    : 0;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <PageHeader
          title="Payroll Export"
          subtitle="Export logged hours as a CSV for payroll import"
        />

        {/* Date range selector */}
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Pay period start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEntries(null);
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Pay period end
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setEntries(null);
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <Button
              onClick={handleLoad}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? "Loading…" : "Load hours"}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </Card>

        {/* Results */}
        {entries !== null && (
          <>
            {entries.length === 0 ? (
              <Card className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No time entries found for this pay period.
              </Card>
            ) : (
              <>
                {/* Summary by employee */}
                <Card className="mb-4">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="font-semibold text-sm">
                        {entries.length} entries &mdash; {totalHours.toFixed(2)}{" "}
                        total hours
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {startDate} → {endDate}
                      </p>
                    </div>
                    <Button onClick={handleExport}>Download CSV</Button>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <th className="px-5 py-3 font-medium">Employee</th>
                        <th className="px-5 py-3 font-medium text-right">
                          Entries
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          Total Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary!.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <td className="px-5 py-3 font-medium">{row.name}</td>
                          <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">
                            {row.entryCount}
                          </td>
                          <td className="px-5 py-3 text-right font-medium">
                            {row.totalHours.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800/50">
                        <td className="px-5 py-3 font-semibold">Total</td>
                        <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400 font-medium">
                          {entries.length}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold">
                          {totalHours.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </Card>

                {/* Detail entries */}
                <Card>
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm">All entries</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          <th className="px-5 py-3 font-medium">Employee</th>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Project</th>
                          <th className="px-5 py-3 font-medium">Description</th>
                          <th className="px-5 py-3 font-medium text-right">
                            Hours
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr
                            key={e.id}
                            className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <td className="px-5 py-3">{e.user.name}</td>
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                              {formatDate(e.date)}
                            </td>
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                              {e.project.name}
                            </td>
                            <td className="px-5 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                              {e.description ?? "—"}
                            </td>
                            <td className="px-5 py-3 text-right font-medium">
                              {Number(e.hours).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
