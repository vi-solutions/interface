"use client";

import React, { useEffect, useRef, useState } from "react";
import type {
  ApiListResponse,
  Client,
  ProjectWithClient,
  TimeEntryReportEntry,
  User,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import { Button, Card, PageHeader } from "@/components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function currentMonthRange(): [string, string] {
  const now = new Date();
  return [
    fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  ];
}

function monthPresets() {
  const now = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    const start = fmt(d);
    const end = fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const label = d.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
    });
    return { label, start, end };
  });
}

// Group entries by date, returning sorted date keys + map
function groupByDate(entries: TimeEntryReportEntry[]) {
  const map = new Map<string, TimeEntryReportEntry[]>();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

// Group entries by task name (null → "No task")
function groupByTask(entries: TimeEntryReportEntry[]) {
  const map = new Map<string, TimeEntryReportEntry[]>();
  for (const e of entries) {
    const key = e.task?.name ?? "No task";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

// ── Report display components ─────────────────────────────────────────────────

function EmployeeReport({
  entries,
  startDate,
  endDate,
  userName,
}: {
  entries: TimeEntryReportEntry[];
  startDate: string;
  endDate: string;
  userName: string;
}) {
  const grouped = groupByDate(entries);
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="report-content">
      <div className="mb-6 print:mb-4">
        <h1 className="text-xl font-bold mb-1">Detailed time report</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDateShort(startDate)} – {formatDateShort(endDate)}
        </p>
        <div className="mt-3 flex gap-8 text-sm">
          <div>
            <span className="font-semibold text-2xl tabular-nums">
              {total.toFixed(2)}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Total hours</p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 self-end pb-0.5">
            <p>
              Team member:{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {userName}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300 dark:border-gray-600">
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400 w-32">
                Date
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Client
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Project
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Task
              </th>
              <th className="text-right py-2 font-semibold text-gray-600 dark:text-gray-400 w-16">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([date, dayEntries]) => {
              const dayTotal = dayEntries.reduce(
                (s, e) => s + Number(e.hours),
                0,
              );
              return (
                <React.Fragment key={`date-${date}`}>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <td
                      className="py-1.5 pr-4 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wide"
                      colSpan={4}
                    >
                      {formatDate(date)}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {dayTotal.toFixed(2)}
                    </td>
                  </tr>
                  {dayEntries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-gray-100 dark:border-gray-700/40"
                    >
                      <td className="py-1.5 pr-4 text-gray-400 dark:text-gray-500 text-xs"></td>
                      <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                        {e.client.name}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                        <div>{e.project.name}</div>
                        {e.description && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {e.description}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400">
                        {e.task?.name ?? "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {Number(e.hours).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td
                colSpan={4}
                className="pt-2 pr-4 text-sm font-bold text-right text-gray-700 dark:text-gray-300"
              >
                Total
              </td>
              <td className="pt-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ClientReport({
  entries,
  startDate,
  endDate,
  clientName,
}: {
  entries: TimeEntryReportEntry[];
  startDate: string;
  endDate: string;
  clientName: string;
}) {
  const grouped = groupByTask(entries);
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="report-content">
      <div className="mb-6 print:mb-4">
        <h1 className="text-xl font-bold mb-1">Detailed time report</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDateShort(startDate)} – {formatDateShort(endDate)}
        </p>
        <div className="mt-3 flex gap-8 text-sm">
          <div>
            <span className="font-semibold text-2xl tabular-nums">
              {total.toFixed(2)}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Total hours</p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 self-end pb-0.5">
            <p>
              Client:{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {clientName}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300 dark:border-gray-600">
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400 w-32">
                Date
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Project
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Person
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="text-right py-2 font-semibold text-gray-600 dark:text-gray-400 w-16">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([taskName, taskEntries]) => {
              const taskTotal = taskEntries.reduce(
                (s, e) => s + Number(e.hours),
                0,
              );
              return (
                <React.Fragment key={`task-${taskName}`}>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <td
                      className="py-1.5 pr-4 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wide"
                      colSpan={4}
                    >
                      {taskName}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {taskTotal.toFixed(2)}
                    </td>
                  </tr>
                  {taskEntries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-gray-100 dark:border-gray-700/40"
                    >
                      <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatDateShort(e.date)}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                        {e.project.name}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                        {e.user.name}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">
                        {e.description ?? "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {Number(e.hours).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td
                colSpan={4}
                className="pt-2 pr-4 text-sm font-bold text-right text-gray-700 dark:text-gray-300"
              >
                Total
              </td>
              <td className="pt-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Project report ────────────────────────────────────────────────────────────

function ProjectReport({
  entries,
  startDate,
  endDate,
  projectName,
  clientName,
}: {
  entries: TimeEntryReportEntry[];
  startDate: string;
  endDate: string;
  projectName: string;
  clientName: string;
}) {
  const grouped = groupByTask(entries);
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);
  const billableHours = entries
    .filter((e) => e.billable)
    .reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="report-content">
      <div className="mb-6 print:mb-4">
        <h1 className="text-xl font-bold mb-1">Detailed time report</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDateShort(startDate)} – {formatDateShort(endDate)}
        </p>
        <div className="mt-4 flex flex-wrap gap-12 text-sm">
          <div>
            <span className="font-semibold text-2xl tabular-nums">
              {total.toFixed(2)}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Total hours</p>
            {billableHours < total && (
              <p className="text-xs text-gray-500 mt-0.5">
                {billableHours.toFixed(2)} billable hours
              </p>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm text-gray-600 dark:text-gray-400 self-start">
            <span className="text-gray-400 dark:text-gray-500">Client</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {clientName}
            </span>
            <span className="text-gray-400 dark:text-gray-500">Project</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {projectName}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300 dark:border-gray-600">
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400 w-28">
                Date
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Person
              </th>
              <th className="text-left py-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">
                Notes
              </th>
              <th className="text-right py-2 font-semibold text-gray-600 dark:text-gray-400 w-16">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([taskName, taskEntries]) => {
              const taskTotal = taskEntries.reduce(
                (s, e) => s + Number(e.hours),
                0,
              );
              const sorted = [...taskEntries].sort((a, b) =>
                a.date.localeCompare(b.date),
              );
              return (
                <React.Fragment key={`task-${taskName}`}>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <td
                      className="py-1.5 pr-4 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wide"
                      colSpan={3}
                    >
                      {taskName}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {taskTotal.toFixed(2)}
                    </td>
                  </tr>
                  {sorted.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-gray-100 dark:border-gray-700/40"
                    >
                      <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 tabular-nums align-top">
                        {formatDateShort(e.date)}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300 align-top whitespace-nowrap">
                        {e.user.name}
                      </td>
                      <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 text-xs align-top">
                        {e.description ?? "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300 align-top">
                        {Number(e.hours).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td
                colSpan={3}
                className="pt-2 pr-4 text-sm font-bold text-right text-gray-700 dark:text-gray-300"
              >
                Total
              </td>
              <td className="pt-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(
  entries: TimeEntryReportEntry[],
  projectName: string,
  startDate: string,
  endDate: string,
) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["Date", "Task", "Person", "Hours", "Notes"].join(",");
  const rows = entries
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.task?.name ?? "").localeCompare(b.task?.name ?? ""),
    )
    .map((e) =>
      [
        e.date,
        esc(e.task?.name ?? "No task"),
        esc(e.user.name),
        Number(e.hours).toFixed(2),
        esc(e.description ?? ""),
      ].join(","),
    );
  const csv = [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `time-report_${projectName.replace(/[^a-zA-Z0-9-]/g, "_")}_${startDate}_${endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { authenticated, user } = useRequireAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"employee" | "client" | "project">(
    "employee",
  );
  const [startDate, setStartDate] = useState(currentMonthRange()[0]);
  const [endDate, setEndDate] = useState(currentMonthRange()[1]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [entries, setEntries] = useState<TimeEntryReportEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportParams, setReportParams] = useState<{
    startDate: string;
    endDate: string;
    userId: string;
    clientId: string;
    projectId: string;
    mode: "employee" | "client" | "project";
  } | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    Promise.all([
      api<ApiListResponse<User>>("/users"),
      api<ApiListResponse<Client>>("/clients"),
      api<ApiListResponse<ProjectWithClient>>("/projects"),
    ]).then(([usersRes, clientsRes, projectsRes]) => {
      setUsers(usersRes.data);
      setClients(clientsRes.data);
      setProjects(projectsRes.data);
      if (usersRes.data[0]) setSelectedUserId(usersRes.data[0].id);
      if (clientsRes.data[0]) setSelectedClientId(clientsRes.data[0].id);
      if (projectsRes.data[0]) setSelectedProjectId(projectsRes.data[0].id);
    });
  }, [authenticated]);

  if (!authenticated || !user?.isAdmin) return null;

  async function handleRun() {
    setLoading(true);
    setError(null);
    setEntries(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (mode === "employee") params.set("userId", selectedUserId);
      else if (mode === "client") params.set("clientId", selectedClientId);
      else params.set("projectId", selectedProjectId);
      const res = await api<ApiListResponse<TimeEntryReportEntry>>(
        `/time-entries/report?${params}`,
      );
      setEntries(res.data);
      setReportParams({
        startDate,
        endDate,
        userId: selectedUserId,
        clientId: selectedClientId,
        projectId: selectedProjectId,
        mode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Frozen at Run time — not affected by picker changes
  const reportUser = users.find((u) => u.id === reportParams?.userId);
  const reportClient = clients.find((c) => c.id === reportParams?.clientId);
  const reportProject = projects.find((p) => p.id === reportParams?.projectId);

  const inputCls =
    "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <AppShell>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; inset: 0; padding: 2cm; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto p-8">
        <PageHeader title="Reports" subtitle="Generate detailed time reports" />

        {/* Controls */}
        <Card className="mb-6 no-print">
          <div className="flex flex-wrap items-end gap-4">
            {/* Mode toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Report type
              </label>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode("employee");
                    setEntries(null);
                  }}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    mode === "employee"
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  By employee
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("client");
                    setEntries(null);
                  }}
                  className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    mode === "client"
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  By client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("project");
                    setEntries(null);
                  }}
                  className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    mode === "project"
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  By project
                </button>
              </div>
            </div>

            {/* Employee, client, or project picker */}
            {mode === "employee" ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Employee
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className={inputCls}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : mode === "client" ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className={inputCls}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className={inputCls}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.client.name} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Month shortcut */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Month
              </label>
              <select
                value={
                  monthPresets().find(
                    (p) => p.start === startDate && p.end === endDate,
                  )?.start ?? ""
                }
                onChange={(e) => {
                  const preset = monthPresets().find(
                    (p) => p.start === e.target.value,
                  );
                  if (preset) {
                    setStartDate(preset.start);
                    setEndDate(preset.end);
                  }
                }}
                className={inputCls}
              >
                <option value="">Custom</option>
                {monthPresets().map((p) => (
                  <option key={p.start} value={p.start}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Date range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <Button
              onClick={handleRun}
              disabled={
                loading ||
                (mode === "employee" && !selectedUserId) ||
                (mode === "client" && !selectedClientId) ||
                (mode === "project" && !selectedProjectId)
              }
            >
              {loading ? "Loading…" : "Run report"}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </Card>

        {/* Results */}
        {entries !== null &&
          (entries.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No time entries found for this period.
            </p>
          ) : (
            <>
              <div className="flex justify-end gap-2 mb-4 no-print">
                {reportParams?.mode === "project" && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      exportCSV(
                        entries,
                        reportProject?.name ?? "project",
                        reportParams.startDate,
                        reportParams.endDate,
                      )
                    }
                  >
                    Export CSV
                  </Button>
                )}
                <Button variant="secondary" onClick={handlePrint}>
                  Print / Save as PDF
                </Button>
              </div>
              <div ref={printRef} className="print-area">
                <Card>
                  {reportParams?.mode === "employee" && reportUser ? (
                    <EmployeeReport
                      entries={entries}
                      startDate={reportParams.startDate}
                      endDate={reportParams.endDate}
                      userName={reportUser.name}
                    />
                  ) : reportParams?.mode === "client" && reportClient ? (
                    <ClientReport
                      entries={entries}
                      startDate={reportParams.startDate}
                      endDate={reportParams.endDate}
                      clientName={reportClient.name}
                    />
                  ) : reportParams?.mode === "project" && reportProject ? (
                    <ProjectReport
                      entries={entries}
                      startDate={reportParams.startDate}
                      endDate={reportParams.endDate}
                      projectName={reportProject.name}
                      clientName={reportProject.client.name}
                    />
                  ) : null}
                </Card>
              </div>
            </>
          ))}
      </div>
    </AppShell>
  );
}
