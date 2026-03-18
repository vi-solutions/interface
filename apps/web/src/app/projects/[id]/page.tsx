"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  ProjectWithClient,
  TimeEntryWithUser,
  CreateTimeEntryDto,
  User,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

export default function ProjectDetailPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [entries, setEntries] = useState<TimeEntryWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadEntries = useCallback(() => {
    api<ApiListResponse<TimeEntryWithUser>>(`/time-entries?projectId=${id}`)
      .then((res) => setEntries(res.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<ProjectWithClient>>(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load project"),
      );
    loadEntries();
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [authenticated, id, loadEntries]);

  if (!authenticated) return null;

  // Group entries by user for the summary
  const byUser = entries.reduce<
    Record<string, { name: string; hours: number; billableHours: number }>
  >((acc, entry) => {
    const key = entry.userId;
    if (!acc[key]) {
      acc[key] = { name: entry.user.name, hours: 0, billableHours: 0 };
    }
    acc[key].hours += Number(entry.hours);
    if (entry.billable) acc[key].billableHours += Number(entry.hours);
    return acc;
  }, {});

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const totalBillable = entries.reduce(
    (sum, e) => sum + (e.billable ? Number(e.hours) : 0),
    0,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateTimeEntryDto = {
      projectId: id,
      userId: currentUser?.isAdmin
        ? (form.get("userId") as string)
        : (currentUser?.id ?? ""),
      date: form.get("date") as string,
      hours: parseFloat(form.get("hours") as string),
      description: (form.get("description") as string) || undefined,
      billable: form.get("billable") === "on",
    };

    try {
      await api<ApiResponse<TimeEntryWithUser>>("/time-entries", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Time entry added");
      setShowForm(false);
      loadEntries();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to save time entry",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entryId: string) {
    try {
      await api(`/time-entries/${entryId}`, { method: "DELETE" });
      addToast("Time entry deleted");
      loadEntries();
    } catch {
      addToast("Failed to delete entry", "error");
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!project && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && (
          <>
            <div className="mb-6">
              <Link
                href="/projects"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back to Projects
              </Link>
            </div>

            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  <Link
                    href={`/clients/${project.client.id}`}
                    className="hover:underline"
                  >
                    {project.client.name}
                  </Link>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/projects/${id}/edit`}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Edit
                </Link>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                  {project.status}
                </span>
              </div>
            </div>

            {project.description && (
              <div className="mb-8">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Description
                </h2>
                <p>{project.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 mb-10">
              {project.phase && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Phase
                  </h3>
                  <p className="mt-1 capitalize">{project.phase}</p>
                </div>
              )}
              {project.startDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Start Date
                  </h3>
                  <p className="mt-1">
                    {new Date(project.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.endDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    End Date
                  </h3>
                  <p className="mt-1">
                    {new Date(project.endDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.budgetCents != null && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Budget
                  </h3>
                  <p className="mt-1">
                    $
                    {(project.budgetCents / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* ── Time Tracking ────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Time Tracking</h2>
                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
                >
                  {showForm ? "Cancel" : "+ Log Time"}
                </button>
              </div>

              {/* ── Add Entry Form ── */}
              {showForm && (
                <form
                  onSubmit={handleSubmit}
                  className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    {currentUser?.isAdmin ? (
                      <select
                        name="userId"
                        required
                        defaultValue={currentUser?.id ?? ""}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select…</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                        {currentUser?.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="hours"
                      type="number"
                      step="0.25"
                      min="0.25"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g. 2.5"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        name="billable"
                        type="checkbox"
                        defaultChecked
                        className="accent-emerald-600"
                      />
                      Billable
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <input
                      name="description"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="What did you work on?"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Entry"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Summary by Employee ── */}
              {entries.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Employee
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Billable
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Total Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byUser).map(([uid, info]) => (
                        <tr
                          key={uid}
                          className="border-b border-gray-100 dark:border-gray-700/50"
                        >
                          <td className="px-4 py-2.5">{info.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {info.billableHours.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {info.hours.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {totalBillable.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {totalHours.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── Individual Entries ── */}
              {entries.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No time entries yet. Click &quot;+ Log Time&quot; to add one.
                </p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Date
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Employee
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Description
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Hours
                        </th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Billable
                        </th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5">{entry.user.name}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {entry.description || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {Number(entry.hours).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {entry.billable ? (
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="inline-block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Delete entry"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
