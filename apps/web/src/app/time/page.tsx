"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  ProjectWithClient,
  TimeEntryWithDetails,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  User,
  Task,
} from "@interface/shared";
import { api } from "@/lib/api";
import {
  formatDateString,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/dates";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

export default function TimePage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTasks, setEditTasks] = useState<Task[]>([]);
  const [editForm, setEditForm] = useState<{
    projectId: string;
    userId: string;
    taskId: string;
    date: string;
    hours: string;
    description: string;
    billable: boolean;
  } | null>(null);

  const loadEntries = useCallback(() => {
    api<ApiListResponse<TimeEntryWithDetails>>("/time-entries")
      .then((res) => setEntries(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated || !currentUser) return;
    loadEntries();
    const projectsUrl = currentUser.isAdmin
      ? "/projects"
      : `/projects?userId=${currentUser.id}`;
    api<ApiListResponse<ProjectWithClient>>(projectsUrl)
      .then((res) => setProjects(res.data))
      .catch(() => {});
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [authenticated, currentUser, loadEntries]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }
    api<ApiListResponse<Task>>(`/tasks?projectId=${selectedProjectId}`)
      .then((res) => setTasks(res.data))
      .catch(() => setTasks([]));
  }, [selectedProjectId]);

  if (!authenticated) return null;

  // Group entries by date for the timeline view
  const byDate = entries.reduce<Record<string, TimeEntryWithDetails[]>>(
    (acc, entry) => {
      const d = toDateInputValue(entry.date);
      if (!acc[d]) acc[d] = [];
      acc[d].push(entry);
      return acc;
    },
    {},
  );

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateTimeEntryDto = {
      projectId: form.get("projectId") as string,
      userId: currentUser?.isAdmin
        ? (form.get("userId") as string)
        : (currentUser?.id ?? ""),
      date: form.get("date") as string,
      hours: parseFloat(form.get("hours") as string),
      description: (form.get("description") as string) || undefined,
      billable: form.get("billable") === "on",
      taskId: (form.get("taskId") as string) || undefined,
    };

    try {
      await api<ApiResponse<TimeEntryWithDetails>>("/time-entries", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Time entry logged");
      (e.target as HTMLFormElement).reset();
      setSelectedProjectId("");
      setTasks([]);
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

  function startEdit(entry: TimeEntryWithDetails) {
    setEditingId(entry.id);
    setEditForm({
      projectId: entry.projectId,
      userId: entry.userId,
      taskId: entry.taskId ?? "",
      date: toDateInputValue(entry.date),
      hours: String(entry.hours),
      description: entry.description ?? "",
      billable: entry.billable,
    });
    api<ApiListResponse<Task>>(`/tasks?projectId=${entry.projectId}`)
      .then((res) => setEditTasks(res.data))
      .catch(() => setEditTasks([]));
  }

  async function handleEditSave() {
    if (!editingId || !editForm) return;
    setSaving(true);
    const dto: UpdateTimeEntryDto = {
      projectId: editForm.projectId,
      userId: editForm.userId,
      taskId: editForm.taskId || undefined,
      date: editForm.date,
      hours: parseFloat(editForm.hours),
      description: editForm.description || undefined,
      billable: editForm.billable,
    };
    try {
      await api<ApiResponse<TimeEntryWithDetails>>(
        `/time-entries/${editingId}`,
        { method: "PUT", body: JSON.stringify(dto) },
      );
      addToast("Time entry updated");
      setEditingId(null);
      setEditForm(null);
      loadEntries();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update entry",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Time Tracking</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Log and review hours across all projects
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-center">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Total Logged
            </p>
            <p className="text-lg font-bold tabular-nums">
              {totalHours.toFixed(1)}h
            </p>
          </div>
        </div>

        {/* ── Log Time Form ── */}
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5"
        >
          <h2 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300">
            Log Time
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                required
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {tasks.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Task</label>
                <select
                  name="taskId"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">No task</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Employee <span className="text-red-500">*</span>
              </label>
              {currentUser?.isAdmin ? (
                <select
                  name="userId"
                  required
                  defaultValue={currentUser?.id ?? ""}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                defaultValue={todayDateInputValue()}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                placeholder="e.g. 2.5"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <input
                name="description"
                placeholder="What did you work on?"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="billable"
                  type="checkbox"
                  defaultChecked
                  className="accent-emerald-600"
                />
                Billable
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Log Entry"}
              </button>
            </div>
          </div>
        </form>

        {/* ── Entries grouped by date ── */}
        {entries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-12">
            No time entries yet. Use the form above to log your first entry.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(byDate).map(([date, dayEntries]) => {
              const dayTotal = dayEntries.reduce(
                (s, e) => s + Number(e.hours),
                0,
              );
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {formatDateString(date, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h3>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                      {dayTotal.toFixed(2)}h
                    </span>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
                    {dayEntries.map((entry) =>
                      editingId === entry.id && editForm ? (
                        <div
                          key={entry.id}
                          className="px-4 py-3 text-sm space-y-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Project
                              </label>
                              <select
                                value={editForm.projectId}
                                onChange={(e) => {
                                  setEditForm((f) =>
                                    f
                                      ? {
                                          ...f,
                                          projectId: e.target.value,
                                          taskId: "",
                                        }
                                      : f,
                                  );
                                  api<ApiListResponse<Task>>(
                                    `/tasks?projectId=${e.target.value}`,
                                  )
                                    .then((res) => setEditTasks(res.data))
                                    .catch(() => setEditTasks([]));
                                }}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {currentUser?.isAdmin && (
                              <div>
                                <label className="block text-xs font-medium mb-1">
                                  Employee
                                </label>
                                <select
                                  value={editForm.userId}
                                  onChange={(e) =>
                                    setEditForm((f) =>
                                      f ? { ...f, userId: e.target.value } : f,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                  {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Task
                              </label>
                              <select
                                value={editForm.taskId}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, taskId: e.target.value } : f,
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="">No task</option>
                                {editTasks.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                value={editForm.date}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, date: e.target.value } : f,
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Hours
                              </label>
                              <input
                                type="number"
                                step="0.25"
                                min="0.25"
                                value={editForm.hours}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f ? { ...f, hours: e.target.value } : f,
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f
                                      ? { ...f, description: e.target.value }
                                      : f,
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editForm.billable}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f
                                      ? { ...f, billable: e.target.checked }
                                      : f,
                                  )
                                }
                                className="accent-emerald-600"
                              />
                              Billable
                            </label>
                            <button
                              onClick={handleEditSave}
                              disabled={saving}
                              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(null);
                              }}
                              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={entry.id}
                          className="flex items-center gap-4 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/projects/${entry.project.id}`}
                                className="font-medium hover:underline truncate"
                              >
                                {entry.project.name}
                              </Link>
                              {entry.billable ? (
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              ) : (
                                <span className="inline-block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                              )}
                            </div>
                            {entry.description && (
                              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                                {entry.description}
                              </p>
                            )}
                          </div>
                          {entry.task && (
                            <span className="text-xs text-emerald-700 dark:text-emerald-300 whitespace-nowrap bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                              {entry.task.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {entry.user.name}
                          </span>
                          <span className="font-medium tabular-nums whitespace-nowrap">
                            {Number(entry.hours).toFixed(2)}h
                          </span>
                          {(currentUser?.isAdmin ||
                            entry.userId === currentUser?.id) && (
                            <button
                              onClick={() => startEdit(entry)}
                              className="text-gray-400 hover:text-emerald-600 transition-colors shrink-0"
                              aria-label="Edit entry"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
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
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
