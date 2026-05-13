"use client";

import { useState } from "react";
import type {
  HarvestPreviewResult,
  HarvestPreviewTimeEntry,
  HarvestPreviewExpense,
  HarvestImportResult,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { useRouter } from "next/navigation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusPill({
  isMapped,
  isDuplicate,
}: {
  isMapped: boolean;
  isDuplicate: boolean;
}) {
  if (!isMapped)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
        unmapped
      </span>
    );
  if (isDuplicate)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        duplicate
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
      import
    </span>
  );
}

type Tab = "time" | "expenses" | "users" | "projects";
type Filter = "all" | "import" | "duplicate" | "unmapped";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HarvestImportPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(sixMonthsAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<HarvestPreviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("time");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState(false);

  if (!authenticated || !currentUser?.isAdmin) {
    if (authenticated) router.push("/");
    return null;
  }

  async function loadPreview() {
    setLoading(true);
    setPreview(null);
    setFilter("all");
    try {
      const data = await api<HarvestPreviewResult>(
        `/harvest/preview?from=${from}&to=${to}`,
      );
      setPreview(data);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to load preview",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    setImporting(true);
    setConfirming(false);
    try {
      const result = await api<HarvestImportResult>(
        `/harvest/import?from=${from}&to=${to}`,
        { method: "POST" },
      );
      addToast(
        `Import complete — ${result.timeInserted} time entries, ${result.expensesInserted} expenses inserted`,
      );
      await loadPreview(); // refresh to show duplicates
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  // ── Filtering ───────────────────────────────────────────────────────────

  function filterEntries<T extends { isMapped: boolean; isDuplicate: boolean }>(
    items: T[],
  ): T[] {
    if (filter === "import")
      return items.filter((i) => i.isMapped && !i.isDuplicate);
    if (filter === "duplicate") return items.filter((i) => i.isDuplicate);
    if (filter === "unmapped") return items.filter((i) => !i.isMapped);
    return items;
  }

  const shownTime = preview ? filterEntries(preview.timeEntries) : [];
  const shownExp = preview ? filterEntries(preview.expenses) : [];

  const inputCls =
    "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      activeTab === t
        ? "border-emerald-500 text-emerald-700 dark:text-emerald-300"
        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    }`;
  const filterBtn = (f: Filter, label: string) => (
    <button
      onClick={() => setFilter(f)}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        filter === f
          ? "bg-emerald-600 text-white"
          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Harvest Import
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Preview and import time entries and expenses from Harvest. Requires{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
              harvest-config.json
            </code>{" "}
            at the repo root.
          </p>
        </div>

        {/* Date controls */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              From
            </label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              To
            </label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            onClick={loadPreview}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading…" : "Load Preview"}
          </button>
        </div>

        {loading && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center text-sm text-gray-400">
            Fetching data from Harvest…
          </div>
        )}

        {preview && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="Time to import"
                value={preview.summary.timeToImport}
                sub={`${preview.summary.timeTotal} total`}
                color="emerald"
              />
              <SummaryCard
                label="Time duplicates"
                value={preview.summary.timeDuplicates}
                color="gray"
              />
              <SummaryCard
                label="Expenses to import"
                value={preview.summary.expenseToImport}
                sub={`${preview.summary.expenseTotal} total`}
                color="emerald"
              />
              <SummaryCard
                label="Expense duplicates"
                value={preview.summary.expenseDuplicates}
                color="gray"
              />
            </div>

            {(preview.summary.timeUnmapped > 0 ||
              preview.summary.expenseUnmapped > 0) && (
              <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                ⚠ {preview.summary.timeUnmapped} time entries and{" "}
                {preview.summary.expenseUnmapped} expenses are unmapped (missing
                project or user mapping) and will be skipped.
              </div>
            )}

            {/* Import button */}
            <div className="mb-6 flex items-center gap-3">
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={
                    importing ||
                    (preview.summary.timeToImport === 0 &&
                      preview.summary.expenseToImport === 0)
                  }
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  {importing
                    ? "Importing…"
                    : `Run Import (${preview.summary.timeToImport + preview.summary.expenseToImport} records)`}
                </button>
              ) : (
                <>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Confirm import?
                  </span>
                  <button
                    onClick={runImport}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    Yes, import
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4 flex gap-1">
              <button
                className={tabCls("time")}
                onClick={() => setActiveTab("time")}
              >
                Time Entries ({preview.timeEntries.length})
              </button>
              <button
                className={tabCls("expenses")}
                onClick={() => setActiveTab("expenses")}
              >
                Expenses ({preview.expenses.length})
              </button>
              <button
                className={tabCls("users")}
                onClick={() => setActiveTab("users")}
              >
                Users ({preview.users.length})
              </button>
              <button
                className={tabCls("projects")}
                onClick={() => setActiveTab("projects")}
              >
                Projects ({preview.projects.length})
              </button>
            </div>

            {/* Filter pills — only for time/expenses tabs */}
            {(activeTab === "time" || activeTab === "expenses") && (
              <div className="flex gap-2 mb-4">
                {filterBtn("all", "All")}
                {filterBtn("import", "To import")}
                {filterBtn("duplicate", "Duplicates")}
                {filterBtn("unmapped", "Unmapped")}
              </div>
            )}

            {/* ── Time Entries tab ────────────────────────────────────── */}
            {activeTab === "time" && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Project
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Task
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        User
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Hours
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 max-w-xs">
                        Notes
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {shownTime.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-sm text-gray-400"
                        >
                          No entries match this filter.
                        </td>
                      </tr>
                    )}
                    {shownTime.map((te) => (
                      <TimeEntryRow key={te.harvestId} te={te} />
                    ))}
                  </tbody>
                </table>
                {shownTime.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-400 text-right">
                    {shownTime.length} rows ·{" "}
                    {shownTime.reduce((s, t) => s + t.hours, 0).toFixed(2)}h
                    total
                  </div>
                )}
              </div>
            )}

            {/* ── Expenses tab ─────────────────────────────────────────── */}
            {activeTab === "expenses" && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Project
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Category
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        User
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Amount
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 max-w-xs">
                        Notes
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {shownExp.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-sm text-gray-400"
                        >
                          No entries match this filter.
                        </td>
                      </tr>
                    )}
                    {shownExp.map((exp) => (
                      <ExpenseRow key={exp.harvestId} exp={exp} />
                    ))}
                  </tbody>
                </table>
                {shownExp.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-400 text-right">
                    {shownExp.length} rows · $
                    {fmt$(shownExp.reduce((s, e) => s + e.totalCents, 0))} total
                  </div>
                )}
              </div>
            )}

            {/* ── Users tab ────────────────────────────────────────────── */}
            {activeTab === "users" && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Harvest name
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Harvest email
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        App user
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {preview.users.map((u) => (
                      <tr
                        key={u.harvestId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="px-4 py-3 font-medium">
                          {u.harvestName}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {u.harvestEmail}
                        </td>
                        <td className="px-4 py-3">
                          {u.appUserName ?? (
                            <span className="text-gray-400 italic">
                              not found
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.matched ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                              unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Projects tab ─────────────────────────────────────────── */}
            {activeTab === "projects" && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Harvest project ID
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        App project UUID
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        App project name
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {preview.projects.map((p) => (
                      <tr
                        key={p.harvestId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {p.harvestId}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {p.appProjectId}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {p.appProjectName ?? (
                            <span className="text-red-500 italic text-xs">
                              UUID not found in DB
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.appProjectName ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                              not found
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  color: "emerald" | "gray";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        color === "emerald"
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          color === "emerald"
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function TimeEntryRow({ te }: { te: HarvestPreviewTimeEntry }) {
  const rowCls = te.isDuplicate
    ? "opacity-40"
    : !te.isMapped
      ? "bg-red-50/40 dark:bg-red-900/10"
      : "";
  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${rowCls}`}
    >
      <td className="px-4 py-2.5 tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {te.date}
      </td>
      <td className="px-4 py-2.5">
        <span className="font-medium">
          {te.appProjectName ?? te.harvestProjectName}
        </span>
        {!te.appProjectName && (
          <span className="block text-xs text-red-400">
            Harvest: {te.harvestProjectName}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
        {te.harvestTaskName}
      </td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
        {te.harvestUserName}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
        {te.hours.toFixed(2)}
      </td>
      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-xs truncate text-xs">
        {te.description}
      </td>
      <td className="px-4 py-2.5">
        <StatusPill isMapped={te.isMapped} isDuplicate={te.isDuplicate} />
      </td>
    </tr>
  );
}

function ExpenseRow({ exp }: { exp: HarvestPreviewExpense }) {
  const rowCls = exp.isDuplicate
    ? "opacity-40"
    : !exp.isMapped
      ? "bg-red-50/40 dark:bg-red-900/10"
      : "";
  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${rowCls}`}
    >
      <td className="px-4 py-2.5 tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {exp.date}
      </td>
      <td className="px-4 py-2.5">
        <span className="font-medium">
          {exp.appProjectName ?? exp.harvestProjectName}
        </span>
        {!exp.appProjectName && (
          <span className="block text-xs text-red-400">
            Harvest: {exp.harvestProjectName}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
        {exp.categoryName}
      </td>
      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
        {exp.harvestUserName}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
        ${(exp.totalCents / 100).toFixed(2)}
      </td>
      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-xs truncate text-xs">
        {exp.notes}
      </td>
      <td className="px-4 py-2.5">
        <StatusPill isMapped={exp.isMapped} isDuplicate={exp.isDuplicate} />
      </td>
    </tr>
  );
}
