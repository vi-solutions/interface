"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import type {
  ApiListResponse,
  ApiResponse,
  TimeEntryWithDetails,
  ProjectWithClient,
  Task,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from "@interface/shared";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function fmtTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TimerData {
  accumulated: number;
  startedAt: number | null;
}

// ── useTimer hook ─────────────────────────────────────────────────────────────
// Persists start/stop state in localStorage under `storageKey`.
// Changing `storageKey` loads a different timer's state.

function useTimer(storageKey: string) {
  const [accumulated, setAccumulated] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Load from localStorage whenever the key changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw) as TimerData;
        setAccumulated(d.accumulated);
        setStartedAt(d.startedAt);
        setElapsed(
          d.startedAt
            ? d.accumulated + Math.floor((Date.now() - d.startedAt) / 1000)
            : d.accumulated,
        );
      } else {
        setAccumulated(0);
        setStartedAt(null);
        setElapsed(0);
      }
    } catch {
      localStorage.removeItem(storageKey);
      setAccumulated(0);
      setStartedAt(null);
      setElapsed(0);
    }
  }, [storageKey]);

  // Tick while running
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      setElapsed(accumulated + Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, accumulated]);

  const persist = (acc: number, sa: number | null) =>
    localStorage.setItem(
      storageKey,
      JSON.stringify({ accumulated: acc, startedAt: sa }),
    );

  const start = () => {
    const now = Date.now();
    setStartedAt(now);
    persist(accumulated, now);
  };

  const stop = (): number => {
    if (startedAt === null) return accumulated;
    const acc = accumulated + Math.floor((Date.now() - startedAt) / 1000);
    setAccumulated(acc);
    setElapsed(acc);
    setStartedAt(null);
    persist(acc, null);
    return acc;
  };

  const reset = () => {
    setAccumulated(0);
    setStartedAt(null);
    setElapsed(0);
    localStorage.removeItem(storageKey);
  };

  return {
    elapsed,
    running: startedAt !== null,
    hasTime: elapsed > 0,
    hours: parseFloat((elapsed / 3600).toFixed(2)),
    start,
    stop,
    reset,
  };
}

// ── TimerRow component ────────────────────────────────────────────────────────
// Compact inline timer shown inside each entry form.
// `onUse(hours)` is called when the user taps "Use Xh".

function TimerRow({
  timer,
  onUse,
}: {
  timer: ReturnType<typeof useTimer>;
  onUse: (hours: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-0.5">
      {/* Clock icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`size-4 shrink-0 ${timer.running ? "text-emerald-500" : "text-gray-400"}`}
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
          clipRule="evenodd"
        />
      </svg>

      {/* Elapsed display */}
      <span
        className={`font-mono text-sm tabular-nums w-16 ${
          timer.running
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {fmtTimer(timer.elapsed)}
      </span>

      {/* Start / Stop */}
      <button
        type="button"
        onClick={() => {
          if (timer.running) {
            const secs = timer.stop();
            onUse(parseFloat((secs / 3600).toFixed(2)));
          } else {
            timer.start();
          }
        }}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
          timer.running
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 active:bg-amber-200"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 active:bg-emerald-200"
        }`}
      >
        {timer.running ? "Stop" : timer.elapsed > 0 ? "Resume" : "Start"}
      </button>

      {/* Reset */}
      {timer.hasTime && !timer.running && (
        <button
          type="button"
          onClick={timer.reset}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700"
        >
          Reset
        </button>
      )}
    </div>
  );
}

// ── TimeEntryRow component ──────────────────────────────────────────────────────
// Each entry in the list gets its own timer (keyed by entry id).
// Tapping the main content area opens the edit form; the timer column is
// a separate tap target that never triggers the edit action.

function TimeEntryRow({
  entry,
  onEdit,
}: {
  entry: TimeEntryWithDetails;
  onEdit: () => void;
}) {
  const timer = useTimer(`timer_entry_${entry.id}`);

  return (
    <div className="flex w-full">
      {/* Tappable content area */}
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        className="flex flex-1 items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-700/30 transition-colors min-w-0"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {entry.project.name}
          </p>
          {entry.task && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
              {entry.task.name}
            </p>
          )}
          {entry.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {entry.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {fmtHours(Number(entry.hours))}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4 text-gray-400"
          >
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
          </svg>
        </div>
      </div>

      {/* Timer column */}
      <div className="flex items-center gap-2 border-l border-gray-100 dark:border-gray-700/50 p-3 shrink-0">
        {/* Start / Stop button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            timer.running ? timer.stop() : timer.start();
          }}
          className={`flex items-center justify-center rounded-xl size-12 ${
            timer.running
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
          }`}
          aria-label={timer.running ? "Stop timer" : "Start timer"}
        >
          {timer.running ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-6"
            >
              <path d="M5.25 3.75a1.5 1.5 0 0 0-1.5 1.5v9.5a1.5 1.5 0 0 0 1.5 1.5h9.5a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5h-9.5Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-6"
            >
              <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
            </svg>
          )}
        </button>

        {/* Elapsed + reset — only shown once timer has been used */}
        {(timer.running || timer.hasTime) && (
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={`font-mono text-base tabular-nums font-semibold ${
                timer.running
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {fmtTimer(timer.elapsed)}
            </span>
            {timer.hasTime && !timer.running && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  timer.reset();
                }}
                className="ml-2 text-sm text-gray-400 dark:text-gray-500 active:text-gray-600"
                aria-label="Reset timer"
              >
                reset
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditState {
  projectId: string;
  taskId: string;
  date: string;
  hours: string;
  description: string;
  billable: boolean;
}

const inputCls =
  "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MobileTimePage() {
  const { authenticated, user } = useRequireAuth();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);

  // New entry form
  const [showForm, setShowForm] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newTasks, setNewTasks] = useState<Task[]>([]);
  const [newHours, setNewHours] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editTasks, setEditTasks] = useState<Task[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Per-form timers — keys are stable for the new form; change per entry for edit
  const timerNew = useTimer("timer_new");
  const timerEdit = useTimer(`timer_entry_${editingId ?? "none"}`);

  const loadEntries = useCallback(() => {
    if (!user) return;
    api<ApiListResponse<TimeEntryWithDetails>>(
      `/time-entries?userId=${user.id}`,
    )
      .then((r) => setEntries(r.data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!authenticated || !user) return;
    loadEntries();
    api<ApiListResponse<ProjectWithClient>>("/projects")
      .then((r) => setProjects(r.data))
      .catch(() => {});
  }, [authenticated, user, loadEntries]);

  useEffect(() => {
    if (!newProjectId) {
      setNewTasks([]);
      return;
    }
    api<ApiListResponse<Task>>(`/tasks?projectId=${newProjectId}`)
      .then((r) => setNewTasks(r.data))
      .catch(() => setNewTasks([]));
  }, [newProjectId]);

  useEffect(() => {
    if (!editState?.projectId) {
      setEditTasks([]);
      return;
    }
    api<ApiListResponse<Task>>(`/tasks?projectId=${editState.projectId}`)
      .then((r) => setEditTasks(r.data))
      .catch(() => setEditTasks([]));
  }, [editState?.projectId]);

  if (!authenticated || !user) return null;

  // ── Group entries by date ────────────────────────────────────
  const byDate = entries.reduce<Record<string, TimeEntryWithDetails[]>>(
    (acc, e) => {
      (acc[e.date] ??= []).push(e);
      return acc;
    },
    {},
  );
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  function startEdit(entry: TimeEntryWithDetails) {
    setEditingId(entry.id);
    setEditState({
      projectId: entry.projectId,
      taskId: entry.taskId ?? "",
      date: entry.date.slice(0, 10),
      hours: String(entry.hours),
      description: entry.description ?? "",
      billable: entry.billable,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setEditTasks([]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    // Stop the timer if it's still running and use its elapsed value for hours
    let finalNewHours = newHours;
    if (timerNew.running) {
      const secs = timerNew.stop();
      if (!finalNewHours || parseFloat(finalNewHours) === 0) {
        finalNewHours = parseFloat((secs / 3600).toFixed(2)).toString();
      }
    }
    const form = new FormData(e.currentTarget);
    const hours =
      parseFloat(finalNewHours) || parseFloat(form.get("hours") as string);
    if (!hours || hours <= 0) {
      addToast("Please enter hours or use the timer", "error");
      setSaving(false);
      return;
    }
    const dto: CreateTimeEntryDto = {
      projectId: form.get("projectId") as string,
      userId: user!.id,
      date: form.get("date") as string,
      hours,
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
      timerNew.reset();
      setShowForm(false);
      setNewProjectId("");
      setNewHours("");
      loadEntries();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to save entry",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editState) return;
    setEditSaving(true);
    // Stop the timer if it's still running and add its elapsed value to hours
    let finalHours = parseFloat(editState.hours) || 0;
    if (timerEdit.running) {
      const secs = timerEdit.stop();
      finalHours = Math.round((finalHours + secs / 3600) * 100) / 100;
    }
    const dto: UpdateTimeEntryDto = {
      projectId: editState.projectId,
      taskId: editState.taskId || undefined,
      date: editState.date,
      hours: finalHours,
      description: editState.description || undefined,
      billable: editState.billable,
    };
    try {
      await api<ApiResponse<TimeEntryWithDetails>>(`/time-entries/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      addToast("Entry updated");
      timerEdit.reset();
      cancelEdit();
      loadEntries();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update entry",
        "error",
      );
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/time-entries/${id}`, { method: "DELETE" });
      addToast("Entry deleted");
      loadEntries();
    } catch {
      addToast("Failed to delete entry", "error");
    }
  }

  return (
    <div className="px-4 pt-8 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Time
        </h1>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            cancelEdit();
            if (showForm) {
              setNewProjectId("");
              setNewHours("");
            }
          }}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700"
        >
          {showForm ? "Cancel" : "+ Log Time"}
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              name="projectId"
              required
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} — ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {newTasks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task
              </label>
              <select name="taskId" className={inputCls}>
                <option value="">No task</option>
                {newTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                required
                defaultValue={todayStr()}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hours{" "}
                {!timerNew.running && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                name="hours"
                required={!timerNew.running}
                min="0.01"
                max="24"
                step="0.01"
                placeholder={timerNew.running ? "timer running…" : "0.00"}
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            {/* Per-entry timer */}
            <TimerRow timer={timerNew} onUse={(h) => setNewHours(String(h))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="What did you work on?"
              className={`${inputCls} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="billable"
              defaultChecked
              className="rounded accent-emerald-600"
            />
            Billable
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
          >
            {saving ? "Saving…" : "Log Entry"}
          </button>
        </form>
      )}

      {/* Empty state */}
      {sortedDates.length === 0 && !showForm && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
          No time entries yet.
        </div>
      )}

      {/* Entries grouped by date */}
      {sortedDates.map((date) => {
        const dayEntries = byDate[date];
        const dayHours = dayEntries.reduce((s, e) => s + Number(e.hours), 0);
        return (
          <div key={date} className="mb-4">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {fmtDate(date)}
              </p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {fmtHours(dayHours)}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
              {dayEntries.map((entry) => {
                const isEditing = editingId === entry.id;

                if (isEditing && editState) {
                  return (
                    <div
                      key={entry.id}
                      className="p-4 space-y-3 bg-emerald-50 dark:bg-emerald-950/20"
                    >
                      {/* Project */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Project
                        </label>
                        <select
                          value={editState.projectId}
                          onChange={(e) =>
                            setEditState(
                              (s) =>
                                s && {
                                  ...s,
                                  projectId: e.target.value,
                                  taskId: "",
                                },
                            )
                          }
                          className={inputCls}
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code ? `${p.code} — ` : ""}
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Task */}
                      {editTasks.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Task
                          </label>
                          <select
                            value={editState.taskId}
                            onChange={(e) =>
                              setEditState(
                                (s) => s && { ...s, taskId: e.target.value },
                              )
                            }
                            className={inputCls}
                          >
                            <option value="">No task</option>
                            {editTasks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Date + Hours */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={editState.date}
                            onChange={(e) =>
                              setEditState(
                                (s) => s && { ...s, date: e.target.value },
                              )
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Hours
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            max="24"
                            step="0.01"
                            value={editState.hours}
                            onChange={(e) =>
                              setEditState(
                                (s) => s && { ...s, hours: e.target.value },
                              )
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>
                      {/* Per-entry timer — "Use" adds to existing hours */}
                      <div className="flex justify-end">
                        <TimerRow
                          timer={timerEdit}
                          onUse={(h) =>
                            setEditState(
                              (s) =>
                                s && {
                                  ...s,
                                  hours: String(
                                    Math.round(
                                      (parseFloat(s.hours || "0") + h) * 100,
                                    ) / 100,
                                  ),
                                },
                            )
                          }
                        />
                      </div>
                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={editState.description}
                          onChange={(e) =>
                            setEditState(
                              (s) => s && { ...s, description: e.target.value },
                            )
                          }
                          className={`${inputCls} resize-none`}
                        />
                      </div>

                      {/* Billable */}
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={editState.billable}
                          onChange={(e) =>
                            setEditState(
                              (s) => s && { ...s, billable: e.target.checked },
                            )
                          }
                          className="rounded accent-emerald-600"
                        />
                        Billable
                      </label>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSaveEdit(entry.id)}
                          disabled={editSaving}
                          className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            cancelEdit();
                            handleDelete(entry.id);
                          }}
                          className="rounded-xl border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20"
                          aria-label="Delete entry"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-4"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={() => {
                      setShowForm(false);
                      startEdit(entry);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
