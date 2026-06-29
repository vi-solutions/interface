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
  UpdateTimeEntryDto,
  DocumentWithDetails,
  UserExpenseWithDetails,
  CreateUserExpenseDto,
  UpdateUserExpenseDto,
  ProjectExpense,
  Milestone,
  ProjectContactWithDetails,
  Task,
  TaskUserBudgetWithUser,
  ProjectUserRateWithUser,
  User,
  ProjectNoteWithAuthor,
  InvoiceListItem,
} from "@interface/shared";
import { api, apiUpload } from "@/lib/api";
import {
  formatDateString,
  localDateFromDateString,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/dates";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

function weekStartKey(iso: string) {
  const date = localDateFromDateString(iso);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toLocaleDateString("en-CA");
}

function formatWeekLabel(iso: string) {
  return formatDateString(iso, {
    day: "numeric",
  });
}

function formatMonthLabel(iso: string) {
  return formatDateString(iso, {
    month: "short",
  });
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ProjectDetailPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [availableProjects, setAvailableProjects] = useState<
    ProjectWithClient[]
  >([]);
  const [entries, setEntries] = useState<TimeEntryWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [userExpenses, setUserExpenses] = useState<UserExpenseWithDetails[]>(
    [],
  );
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState<{
    date: string;
    amount: string;
    notes: string;
  } | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectContacts, setProjectContacts] = useState<
    ProjectContactWithDetails[]
  >([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskUserBudgets, setTaskUserBudgets] = useState<
    Record<string, TaskUserBudgetWithUser[]>
  >({});
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [projectUserRates, setProjectUserRates] = useState<
    ProjectUserRateWithUser[]
  >([]);
  const [notes, setNotes] = useState<ProjectNoteWithAuthor[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [movingEntryId, setMovingEntryId] = useState<string | null>(null);
  const [moveProjectId, setMoveProjectId] = useState("");
  const [editEntryForm, setEditEntryForm] = useState<{
    userId: string;
    taskId: string;
    date: string;
    hours: string;
    description: string;
    billable: boolean;
  } | null>(null);

  const loadEntries = useCallback(() => {
    api<ApiListResponse<TimeEntryWithUser>>(`/time-entries?projectId=${id}`)
      .then((res) => setEntries(res.data))
      .catch(() => {});
  }, [id]);

  const loadDocuments = useCallback(() => {
    api<ApiListResponse<DocumentWithDetails>>(`/documents?projectId=${id}`)
      .then((res) => setDocuments(res.data))
      .catch(() => {});
  }, [id]);

  const loadUserExpenses = useCallback(() => {
    api<ApiListResponse<UserExpenseWithDetails>>(
      `/user-expenses?projectId=${id}`,
    )
      .then((res) => setUserExpenses(res.data))
      .catch(() => {});
  }, [id]);

  const loadInvoices = useCallback(() => {
    api<ApiListResponse<InvoiceListItem>>(`/invoices?projectId=${id}`)
      .then((res) => setInvoices(res.data))
      .catch(() => {});
  }, [id]);

  const loadProjectExpenses = useCallback(() => {
    api<ApiListResponse<ProjectExpense>>(`/project-expenses?projectId=${id}`)
      .then((res) => setProjectExpenses(res.data))
      .catch(() => {});
  }, [id]);

  const loadMilestones = useCallback(() => {
    api<ApiListResponse<Milestone>>(`/milestones?projectId=${id}`)
      .then((res) => setMilestones(res.data))
      .catch(() => {});
  }, [id]);

  const loadProjectContacts = useCallback(() => {
    api<ApiListResponse<ProjectContactWithDetails>>(
      `/project-contacts?projectId=${id}`,
    )
      .then((res) => setProjectContacts(res.data))
      .catch(() => {});
  }, [id]);

  const loadTimeCategories = useCallback(() => {
    api<ApiListResponse<Task>>(`/tasks?projectId=${id}`)
      .then(async (res) => {
        setTasks(res.data);
        const results = await Promise.all(
          res.data.map((t) =>
            api<ApiListResponse<TaskUserBudgetWithUser>>(
              `/tasks/${t.id}/user-budgets`,
            )
              .then((r) => ({ taskId: t.id, budgets: r.data }))
              .catch(() => ({
                taskId: t.id,
                budgets: [] as TaskUserBudgetWithUser[],
              })),
          ),
        );
        const map: Record<string, TaskUserBudgetWithUser[]> = {};
        for (const r of results) map[r.taskId] = r.budgets;
        setTaskUserBudgets(map);
      })
      .catch(() => {});
  }, [id]);

  const loadProjectUserRates = useCallback(() => {
    api<ApiListResponse<ProjectUserRateWithUser>>(
      `/project-user-rates?projectId=${id}`,
    )
      .then((res) => setProjectUserRates(res.data))
      .catch(() => {});
  }, [id]);

  const loadNotes = useCallback(() => {
    api<ApiListResponse<ProjectNoteWithAuthor>>(
      `/project-notes?projectId=${id}`,
    )
      .then((res) => setNotes(res.data))
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
    loadDocuments();
    loadInvoices();
    loadUserExpenses();
    loadProjectExpenses();
    loadMilestones();
    loadProjectContacts();
    loadTimeCategories();
    loadProjectUserRates();
    loadNotes();
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [
    authenticated,
    id,
    loadEntries,
    loadDocuments,
    loadInvoices,
    loadUserExpenses,
    loadProjectExpenses,
    loadMilestones,
    loadProjectContacts,
    loadTimeCategories,
    loadProjectUserRates,
    loadNotes,
  ]);

  useEffect(() => {
    if (!authenticated || !currentUser) return;
    const projectsUrl = currentUser.isAdmin
      ? "/projects"
      : `/projects?userId=${currentUser.id}`;
    api<ApiListResponse<ProjectWithClient>>(projectsUrl)
      .then((res) => setAvailableProjects(res.data))
      .catch(() => {});
  }, [authenticated, currentUser]);

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

  // Group entries by task for the hour summary
  const byTask = entries.reduce<
    Record<string, { name: string; hours: number }>
  >((acc, entry) => {
    const key = entry.task?.id ?? "_none";
    if (!acc[key]) {
      acc[key] = { name: entry.task?.name ?? "No Task", hours: 0 };
    }
    acc[key].hours += Number(entry.hours);
    return acc;
  }, {});

  // Per-user logged hours per task
  const byTaskUser = entries.reduce<Record<string, Record<string, number>>>(
    (acc, entry) => {
      const taskKey = entry.task?.id ?? "_none";
      if (!acc[taskKey]) acc[taskKey] = {};
      acc[taskKey][entry.userId] =
        (acc[taskKey][entry.userId] ?? 0) + Number(entry.hours);
      return acc;
    },
    {},
  );

  const taskBudget = tasks.reduce(
    (acc, task) => {
      if (task.budgetHours == null || Number(task.budgetHours) <= 0) {
        return acc;
      }
      acc.used += byTask[task.id]?.hours ?? 0;
      acc.total += Number(task.budgetHours);
      return acc;
    },
    { used: 0, total: 0 },
  );
  const taskBudgetPct =
    taskBudget.total > 0 ? (taskBudget.used / taskBudget.total) * 100 : null;
  const weeklyHours = Array.from(
    entries
      .reduce<
        Map<
          string,
          { weekStart: string; billable: number; nonBillable: number }
        >
      >((acc, entry) => {
        const key = weekStartKey(entry.date);
        const week = acc.get(key) ?? {
          weekStart: key,
          billable: 0,
          nonBillable: 0,
        };
        if (entry.billable) {
          week.billable += Number(entry.hours);
        } else {
          week.nonBillable += Number(entry.hours);
        }
        acc.set(key, week);
        return acc;
      }, new Map())
      .values(),
  ).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const maxWeeklyHours = Math.max(
    0,
    ...weeklyHours.flatMap((week) => [week.billable, week.nonBillable]),
  );
  const hasNonBillableHours = weeklyHours.some((week) => week.nonBillable > 0);
  const weeklyScaleStep =
    maxWeeklyHours <= 4
      ? 1
      : maxWeeklyHours <= 8
        ? 2
        : maxWeeklyHours <= 20
          ? 5
          : 10;
  const weeklyScaleMax =
    maxWeeklyHours > 0
      ? Math.ceil(maxWeeklyHours / weeklyScaleStep) * weeklyScaleStep
      : weeklyScaleStep * 4;
  const weeklyScaleTicks = Array.from({ length: 5 }, (_, index) =>
    Number(((weeklyScaleMax / 4) * (4 - index)).toFixed(1)),
  );

  // Build a rate lookup: userId -> hourly charge-out rate in cents
  const rateByUser: Record<string, number> = {};
  for (const u of users) {
    rateByUser[u.id] = u.rateCents; // default charge-out rate
  }
  for (const pur of projectUserRates) {
    if (pur.hourlyRateCents != null) {
      rateByUser[pur.userId] = pur.hourlyRateCents;
    }
  }

  // Build a cost lookup: userId -> hourly cost in cents
  const costByUser: Record<string, number> = {};
  for (const u of users) {
    costByUser[u.id] = u.hourlyCostCents;
  }

  // Revenue = sum of billable hours × charge-out rate
  const revenueCents = entries.reduce((sum, e) => {
    if (!e.billable) return sum;
    return sum + Number(e.hours) * (rateByUser[e.userId] ?? 0);
  }, 0);

  // Cost = sum of all hours × hourly wage + 15% burden (vacation, EI, CPP, etc.)
  const BURDEN_RATE = 1.15;
  const laborCostCents = entries.reduce((sum, e) => {
    return sum + Number(e.hours) * (costByUser[e.userId] ?? 0) * BURDEN_RATE;
  }, 0);

  const netProfitCents = revenueCents - laborCostCents;

  // Budget tracking
  const expensesTotalCents = userExpenses.reduce(
    (sum, e) => sum + Number(e.totalCents),
    0,
  );
  const budgetUsedCents = revenueCents;
  const budgetRemainingCents =
    project != null && project.budgetCents != null
      ? project.budgetCents - budgetUsedCents
      : null;
  const budgetPct =
    project?.budgetCents && project.budgetCents > 0
      ? Math.min(100, (budgetUsedCents / project.budgetCents) * 100)
      : null;
  const budgetHoursRemaining =
    project?.budgetHours != null
      ? Number(project.budgetHours) - totalHours
      : null;
  const budgetHoursPct =
    project?.budgetHours && Number(project.budgetHours) > 0
      ? Math.min(100, (totalHours / Number(project.budgetHours)) * 100)
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateTimeEntryDto = {
      projectId: id,
      userId: currentUser?.isAdmin
        ? (form.get("userId") as string)
        : (currentUser?.id ?? ""),
      taskId: (form.get("taskId") as string) || undefined,
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

  function startEditEntry(entry: TimeEntryWithUser) {
    setMovingEntryId(null);
    setMoveProjectId("");
    setEditingEntryId(entry.id);
    setEditEntryForm({
      userId: entry.userId,
      taskId: entry.taskId ?? "",
      date: toDateInputValue(entry.date),
      hours: String(entry.hours),
      description: entry.description ?? "",
      billable: entry.billable,
    });
  }

  function startMoveEntry(entry: TimeEntryWithUser) {
    setEditingEntryId(null);
    setEditEntryForm(null);
    setMovingEntryId(entry.id);
    setMoveProjectId("");
  }

  async function handleEditEntrySave() {
    if (!editingEntryId || !editEntryForm) return;
    setSaving(true);
    const dto: UpdateTimeEntryDto = {
      projectId: id,
      userId: editEntryForm.userId,
      taskId: editEntryForm.taskId || undefined,
      date: editEntryForm.date,
      hours: parseFloat(editEntryForm.hours),
      description: editEntryForm.description || undefined,
      billable: editEntryForm.billable,
    };
    try {
      await api<ApiResponse<TimeEntryWithUser>>(
        `/time-entries/${editingEntryId}`,
        { method: "PUT", body: JSON.stringify(dto) },
      );
      addToast("Time entry updated");
      setEditingEntryId(null);
      setEditEntryForm(null);
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

  async function handleMoveEntrySave() {
    if (!movingEntryId || !moveProjectId || moveProjectId === id) return;
    setSaving(true);
    const dto: UpdateTimeEntryDto = {
      projectId: moveProjectId,
      taskId: null,
    };
    try {
      await api<ApiResponse<TimeEntryWithUser>>(
        `/time-entries/${movingEntryId}`,
        { method: "PUT", body: JSON.stringify(dto) },
      );
      addToast("Time entry moved");
      setMovingEntryId(null);
      setMoveProjectId("");
      loadEntries();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to move entry",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDocDelete(docId: string) {
    try {
      await api(`/documents/${docId}`, { method: "DELETE" });
      addToast("Document removed");
      loadDocuments();
    } catch {
      addToast("Failed to remove document", "error");
    }
  }

  function startEditExpense(expense: UserExpenseWithDetails) {
    const amount =
      expense.expenseType === "dollar"
        ? (Number(expense.totalCents) / 100).toFixed(2)
        : String(Number(expense.quantity ?? 0));
    setEditingExpenseId(expense.id);
    setEditExpenseForm({
      date: toDateInputValue(expense.date),
      amount,
      notes: expense.notes ?? "",
    });
  }

  async function handleEditExpenseSave(expense: UserExpenseWithDetails) {
    if (!editingExpenseId || !editExpenseForm) return;
    setSavingExpense(true);
    const value = parseFloat(editExpenseForm.amount);
    const dto: UpdateUserExpenseDto = {
      date: editExpenseForm.date,
      notes: editExpenseForm.notes || undefined,
    };

    if (expense.expenseType === "dollar") {
      dto.totalCents = Math.round((Number.isFinite(value) ? value : 0) * 100);
    } else {
      const quantity = Number.isFinite(value) ? value : 0;
      const projectExpense = projectExpenses.find(
        (pe) => pe.id === expense.projectExpenseId,
      );
      dto.quantity = quantity;
      dto.totalCents = Math.round(
        quantity * Number(projectExpense?.rateCents ?? 0),
      );
    }

    try {
      await api<ApiResponse<UserExpenseWithDetails>>(
        `/user-expenses/${expense.id}`,
        {
          method: "PUT",
          body: JSON.stringify(dto),
        },
      );
      addToast("Expense updated");
      setEditingExpenseId(null);
      setEditExpenseForm(null);
      loadUserExpenses();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update expense",
        "error",
      );
    } finally {
      setSavingExpense(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
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
                <h1 className="text-2xl font-bold">
                  {project.code && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">
                      {project.code}
                    </span>
                  )}
                  {project.name}
                </h1>
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
                {currentUser?.isAdmin && (
                  <Link
                    href={`/projects/${id}/edit`}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </Link>
                )}
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                  {project.status}
                </span>
              </div>
            </div>

            {project.description && (
              <div className="mb-8">
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
                  <p className="mt-1">{formatDateString(project.startDate)}</p>
                </div>
              )}
              {project.endDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    End Date
                  </h3>
                  <p className="mt-1">{formatDateString(project.endDate)}</p>
                </div>
              )}
              {project.projectManager && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Project Manager
                  </h3>
                  <p className="mt-1">{project.projectManager.name}</p>
                </div>
              )}
              {projectContacts.length > 0 && (
                <div className="sm:col-span-2">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Contacts
                  </h3>
                  <div className="mt-1 space-y-1">
                    {projectContacts.map((pc) => (
                      <div
                        key={pc.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="font-medium">{pc.contact.name}</span>
                        {pc.contact.agency && (
                          <span className="text-gray-500 dark:text-gray-400">
                            — {pc.contact.agency}
                          </span>
                        )}
                        {pc.contact.title && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {pc.contact.agency
                              ? `, ${pc.contact.title}`
                              : `— ${pc.contact.title}`}
                          </span>
                        )}
                        {pc.contact.email && (
                          <a
                            href={`mailto:${pc.contact.email}`}
                            className="text-gray-400 dark:text-gray-500 hover:underline text-xs ml-auto"
                          >
                            {pc.contact.email}
                          </a>
                        )}
                        {pc.contact.phone && (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">
                            {pc.contact.phone}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Project Metrics ──────────────────────────────── */}
            {entries.length > 0 && (
              <div className="mb-10 space-y-6">
                {/* Financial summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {currentUser?.isAdmin && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Revenue
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        $
                        {(revenueCents / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {totalBillable.toFixed(1)}h billable
                      </p>
                    </div>
                  )}
                  {currentUser?.isAdmin && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Labor Cost
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        $
                        {(laborCostCents / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {totalHours.toFixed(1)}h total
                      </p>
                    </div>
                  )}
                  {currentUser?.isAdmin && (
                    <div
                      className={`rounded-lg border p-4 ${
                        netProfitCents >= 0
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Net Profit
                      </p>
                      <p
                        className={`mt-1 text-xl font-bold tabular-nums ${
                          netProfitCents >= 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {netProfitCents < 0 ? "−" : ""}$
                        {(Math.abs(netProfitCents) / 100).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </p>
                      {revenueCents > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {((netProfitCents / revenueCents) * 100).toFixed(0)}%
                          margin
                        </p>
                      )}
                    </div>
                  )}
                  {currentUser?.isAdmin && taskBudgetPct != null && (
                    <div
                      className={`rounded-lg border p-4 ${
                        taskBudgetPct < 90
                          ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                          : taskBudgetPct < 100
                            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Task Budget
                      </p>
                      <p
                        className={`mt-1 text-xl font-bold tabular-nums ${
                          taskBudgetPct >= 100
                            ? "text-red-700 dark:text-red-300"
                            : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {taskBudget.used.toFixed(1)} /{" "}
                        {taskBudget.total.toFixed(1)}h
                      </p>
                      <div className="mt-2">
                        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={`h-1.5 rounded-full ${
                              taskBudgetPct >= 90
                                ? "bg-red-500"
                                : taskBudgetPct >= 70
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(100, taskBudgetPct)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {taskBudgetPct.toFixed(0)}% used
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin: dollar budget row */}
                {currentUser?.isAdmin && project.budgetCents != null && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div
                      className={`rounded-lg border p-4 ${
                        budgetPct != null && budgetPct >= 100
                          ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                          : budgetPct != null && budgetPct >= 90
                            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Dollar Budget
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(budgetUsedCents)} /{" "}
                        {formatCurrency(project.budgetCents)}
                      </p>
                      {budgetPct != null && (
                        <div className="mt-4">
                          <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className={`h-1.5 rounded-full ${
                                budgetPct >= 90
                                  ? "bg-red-500"
                                  : budgetPct >= 70
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${budgetPct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {budgetPct.toFixed(0)}% used
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin: hours budget row */}
                {currentUser?.isAdmin && project.budgetHours != null && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div
                      className={`rounded-lg border p-4 ${
                        budgetHoursRemaining != null &&
                        budgetHoursRemaining >= 0
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Hours Remaining
                      </p>
                      <p
                        className={`mt-1 text-xl font-bold tabular-nums ${
                          budgetHoursRemaining != null &&
                          budgetHoursRemaining >= 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {budgetHoursRemaining != null
                          ? `${budgetHoursRemaining < 0 ? "−" : ""}${Math.abs(budgetHoursRemaining).toFixed(1)} / ${Number(project.budgetHours).toFixed(1)}h`
                          : "—"}
                      </p>
                      {budgetHoursPct != null && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className={`h-1.5 rounded-full ${
                                budgetHoursPct >= 90
                                  ? "bg-red-500"
                                  : budgetHoursPct >= 70
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${budgetHoursPct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {budgetHoursPct.toFixed(0)}% used
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Employee: budget % only */}
                {!currentUser?.isAdmin &&
                  (project.budgetCents != null ||
                    project.budgetHours != null) && (
                    <div className="grid grid-cols-1 gap-4">
                      <div
                        className={`rounded-lg border p-4 ${
                          (budgetHoursPct ?? budgetPct ?? 0) < 90
                            ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            : (budgetHoursPct ?? budgetPct ?? 0) < 100
                              ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                        }`}
                      >
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Budget
                        </p>
                        {project.budgetHours != null ? (
                          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                            {totalHours.toFixed(1)} /{" "}
                            {Number(project.budgetHours).toFixed(0)}h
                          </p>
                        ) : (
                          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                            {(budgetPct ?? 0).toFixed(0)}% used
                          </p>
                        )}
                        {(budgetHoursPct ?? budgetPct) != null && (
                          <div className="mt-2">
                            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className={`h-1.5 rounded-full ${
                                  (budgetHoursPct ?? budgetPct ?? 0) >= 90
                                    ? "bg-red-500"
                                    : (budgetHoursPct ?? budgetPct ?? 0) >= 70
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                                style={{
                                  width: `${budgetHoursPct ?? budgetPct}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {(budgetHoursPct ?? budgetPct ?? 0).toFixed(0)}%
                              used
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {weeklyHours.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Hours by Week
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                          Billable
                        </span>
                        {hasNonBillableHours && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                            Non-billable
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto overflow-y-hidden">
                      <div className="flex min-w-max items-start pr-2">
                        <div className="relative pb-14">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-48">
                            {weeklyScaleTicks.map((tick) => (
                              <div
                                key={tick}
                                className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/60"
                                style={{
                                  top: `${100 - (tick / weeklyScaleMax) * 100}%`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="relative flex h-48 items-end gap-1.5 border-b border-gray-200 dark:border-gray-700">
                            {weeklyHours.map((week, index) => {
                              const weekMonth = week.weekStart.slice(0, 7);
                              const previousMonth = weeklyHours[
                                index - 1
                              ]?.weekStart.slice(0, 7);
                              const startsMonth =
                                index === 0 || weekMonth !== previousMonth;
                              const billableHeight =
                                week.billable > 0
                                  ? Math.max(
                                      7,
                                      (week.billable / weeklyScaleMax) * 173,
                                    )
                                  : 0;
                              const nonBillableHeight =
                                week.nonBillable > 0
                                  ? Math.max(
                                      7,
                                      (week.nonBillable / weeklyScaleMax) * 173,
                                    )
                                  : 0;
                              const weekHasNonBillable = week.nonBillable > 0;

                              return (
                                <div
                                  key={week.weekStart}
                                  className="relative flex w-[4.5rem] shrink-0 flex-col items-center"
                                >
                                  {startsMonth && index > 0 && (
                                    <div className="absolute -left-0.5 bottom-0 h-48 border-l border-gray-300 dark:border-gray-600" />
                                  )}
                                  <div
                                    className="flex h-48 items-end gap-1.5"
                                    title={
                                      weekHasNonBillable
                                        ? `Billable ${week.billable.toFixed(1)}, non-billable ${week.nonBillable.toFixed(1)}`
                                        : `Billable ${week.billable.toFixed(1)}`
                                    }
                                  >
                                    <div
                                      className={
                                        weekHasNonBillable
                                          ? "w-4 bg-emerald-600"
                                          : "w-6 bg-emerald-600"
                                      }
                                      style={{
                                        height: `${billableHeight}px`,
                                      }}
                                    />
                                    {weekHasNonBillable && (
                                      <div
                                        className="w-4 bg-gray-300 dark:bg-gray-600"
                                        style={{
                                          height: `${nonBillableHeight}px`,
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div className="absolute top-full mt-1.5 w-full text-center">
                                    {weekHasNonBillable ? (
                                      <p className="flex justify-center gap-1 text-xs font-medium tabular-nums">
                                        <span className="text-emerald-700 dark:text-emerald-400">
                                          {week.billable.toFixed(1)}
                                        </span>
                                        <span className="text-gray-400">/</span>
                                        <span className="text-gray-500 dark:text-gray-400">
                                          {week.nonBillable.toFixed(1)}
                                        </span>
                                      </p>
                                    ) : (
                                      <p className="text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                                        {week.billable.toFixed(1)}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatWeekLabel(week.weekStart)}
                                    </p>
                                    <p className="h-5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                      {startsMonth
                                        ? formatMonthLabel(week.weekStart)
                                        : ""}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="relative ml-4 h-48 w-10 shrink-0 border-l border-gray-200 dark:border-gray-700 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {weeklyScaleTicks.map((tick) => (
                            <span
                              key={tick}
                              className="absolute right-0 -translate-y-1/2"
                              style={{
                                top: `calc(${100 - (tick / weeklyScaleMax) * 100}% + ${
                                  tick === weeklyScaleMax
                                    ? "0.375rem"
                                    : tick === 0
                                      ? "-0.375rem"
                                      : "0rem"
                                })`,
                              }}
                            >
                              {tick}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Notes ─────────────────────────────────────────── */}
                <section className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Notes</h2>
                    {!addingNote && (
                      <button
                        onClick={() => setAddingNote(true)}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
                      >
                        + Note
                      </button>
                    )}
                  </div>

                  {addingNote && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newNoteContent.trim()) return;
                        setSavingNote(true);
                        try {
                          await api<ApiResponse<ProjectNoteWithAuthor>>(
                            "/project-notes",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                projectId: id,
                                userId: currentUser!.id,
                                content: newNoteContent.trim(),
                              }),
                            },
                          );
                          setNewNoteContent("");
                          setAddingNote(false);
                          loadNotes();
                        } catch {
                          addToast("Failed to save note", "error");
                        } finally {
                          setSavingNote(false);
                        }
                      }}
                      className="mb-4"
                    >
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Add a note…"
                        rows={3}
                        autoFocus
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingNote(false);
                            setNewNoteContent("");
                          }}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingNote || !newNoteContent.trim()}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {savingNote ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                    {notes.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        No notes yet.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {notes.map((note) => {
                          const isEdited =
                            new Date(note.updatedAt).getTime() -
                              new Date(note.createdAt).getTime() >
                            2000;
                          const isEditing = editingNoteId === note.id;
                          const canEdit = currentUser?.id === note.userId;
                          const canDelete =
                            currentUser?.isAdmin ||
                            currentUser?.id === note.userId;

                          return (
                            <div
                              key={note.id}
                              className="border-l-2 border-emerald-500 pl-3 py-0.5"
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingNoteContent}
                                    onChange={(e) =>
                                      setEditingNoteContent(e.target.value)
                                    }
                                    rows={3}
                                    autoFocus
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        if (!editingNoteContent.trim()) return;
                                        try {
                                          await api<
                                            ApiResponse<ProjectNoteWithAuthor>
                                          >(`/project-notes/${note.id}`, {
                                            method: "PUT",
                                            body: JSON.stringify({
                                              content:
                                                editingNoteContent.trim(),
                                            }),
                                          });
                                          setEditingNoteId(null);
                                          loadNotes();
                                        } catch {
                                          addToast(
                                            "Failed to update note",
                                            "error",
                                          );
                                        }
                                      }}
                                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingNoteId(null)}
                                      className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-1">
                                  {note.content}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 ml-2">
                                <span className="font-medium text-gray-500 dark:text-gray-400">
                                  {note.author.name}
                                </span>
                                <span>·</span>
                                {isEdited ? (
                                  <span className="italic">
                                    edited{" "}
                                    <time dateTime={note.updatedAt}>
                                      {new Date(
                                        note.updatedAt,
                                      ).toLocaleString()}
                                    </time>
                                  </span>
                                ) : (
                                  <time dateTime={note.createdAt}>
                                    {new Date(note.createdAt).toLocaleString()}
                                  </time>
                                )}
                                {(canEdit || canDelete) && !isEditing && (
                                  <>
                                    <span>·</span>
                                    {canEdit && (
                                      <button
                                        onClick={() => {
                                          setEditingNoteId(note.id);
                                          setEditingNoteContent(note.content);
                                        }}
                                        className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-transparent"
                                      >
                                        edit
                                      </button>
                                    )}
                                    {canEdit && canDelete && <span>·</span>}
                                    {canDelete && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await api(
                                              `/project-notes/${note.id}`,
                                              {
                                                method: "DELETE",
                                              },
                                            );
                                            loadNotes();
                                          } catch {
                                            addToast(
                                              "Failed to delete note",
                                              "error",
                                            );
                                          }
                                        }}
                                        className="hover:text-red-500 transition-colors bg-transparent"
                                      >
                                        delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
                {/* Milestones */}
                {milestones.length > 0 && (
                  <section className="mb-10">
                    <h2 className="text-lg font-semibold mb-4">Milestones</h2>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                      <div className="space-y-2">
                        {milestones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-sm">{m.name}</span>
                            {m.date ? (
                              <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                                {formatDateString(m.date, undefined, "en-CA")}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Documents ────────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4">Documents</h2>

              {/* Upload dropzones per category */}
              {project.code && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <CategoryDropzone
                      key={cat}
                      category={cat}
                      projectId={id}
                      documents={documents.filter((d) => d.category === cat)}
                      onUploadComplete={loadDocuments}
                      onDelete={handleDocDelete}
                    />
                  ))}
                </div>
              )}

              {currentUser?.isAdmin && !project.code && (
                <div className="mb-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Set a project code on the{" "}
                  <Link
                    href={`/projects/${id}/edit`}
                    className="text-emerald-600 hover:underline"
                  >
                    edit page
                  </Link>{" "}
                  to enable file uploads with organized Drive folders.
                </div>
              )}

              {/* Uncategorized documents */}
              {documents.filter((d) => !d.category).length > 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
                  {documents
                    .filter((d) => !d.category)
                    .map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onDelete={handleDocDelete}
                      />
                    ))}
                </div>
              )}
            </section>

            {/* ── User Expenses ─────────────────────────────────── */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Invoices</h2>
                {currentUser?.isAdmin && (
                  <Link
                    href="/invoices"
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    New invoice
                  </Link>
                )}
              </div>

              {invoices.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No invoices yet for this project.
                </p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Period
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Total
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Status
                        </th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <td className="px-4 py-2.5 tabular-nums text-gray-600 dark:text-gray-300">
                            {formatDateString(
                              inv.periodStart,
                              undefined,
                              "en-CA",
                            )}{" "}
                            –{" "}
                            {formatDateString(
                              inv.periodEnd,
                              undefined,
                              "en-CA",
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            ${(Number(inv.totalCents) / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium capitalize text-gray-700 dark:text-gray-300">
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Expenses</h2>
                <button
                  onClick={() => setShowExpenseForm((v) => !v)}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
                >
                  {showExpenseForm ? "Cancel" : "+ Log Expense"}
                </button>
              </div>

              {showExpenseForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingExpense(true);
                    const form = new FormData(e.currentTarget);
                    const peId = form.get("projectExpenseId") as string;
                    const pe = projectExpenses.find((p) => p.id === peId);
                    const valueStr = form.get("amount") as string;
                    const value = parseFloat(valueStr);
                    let totalCents: number;
                    let quantity: number | undefined;

                    if (pe?.type === "dollar") {
                      totalCents = Math.round(value * 100);
                    } else {
                      quantity = value;
                      totalCents = Math.round(value * (pe?.rateCents ?? 0));
                    }

                    const dto: CreateUserExpenseDto = {
                      projectId: id,
                      userId: currentUser?.isAdmin
                        ? (form.get("userId") as string)
                        : (currentUser?.id ?? ""),
                      projectExpenseId: peId,
                      date: form.get("date") as string,
                      quantity,
                      totalCents,
                      notes: (form.get("notes") as string) || undefined,
                    };
                    try {
                      await api<ApiResponse<UserExpenseWithDetails>>(
                        "/user-expenses",
                        { method: "POST", body: JSON.stringify(dto) },
                      );
                      addToast("Expense logged");
                      setShowExpenseForm(false);
                      loadUserExpenses();
                    } catch (err) {
                      addToast(
                        err instanceof Error
                          ? err.message
                          : "Failed to log expense",
                        "error",
                      );
                    } finally {
                      setSavingExpense(false);
                    }
                  }}
                  className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Expense Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="projectExpenseId"
                      required
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select…</option>
                      {projectExpenses.map((pe) => (
                        <option key={pe.id} value={pe.id}>
                          {pe.name}{" "}
                          {pe.type !== "dollar" &&
                            `($${(pe.rateCents / 100).toFixed(2)}/${pe.type === "per_km" ? "km" : "day"})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentUser?.isAdmin ? (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Employee <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="userId"
                        required
                        defaultValue={currentUser?.id ?? ""}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select…</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Employee
                      </label>
                      <p className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm">
                        {currentUser?.name}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={todayDateInputValue()}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Amount ($) / Quantity{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Notes
                    </label>
                    <input
                      name="notes"
                      placeholder="Optional notes"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={savingExpense}
                      className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {savingExpense ? "Logging…" : "Log Expense"}
                    </button>
                  </div>
                </form>
              )}

              {userExpenses.length === 0 && !showExpenseForm ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No expenses logged yet. Click &quot;+ Log Expense&quot; to add
                  one.
                </p>
              ) : userExpenses.length > 0 ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Date
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Expense
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Employee
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Qty
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Total
                        </th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {userExpenses.map((ue) => {
                        const canManage =
                          currentUser?.isAdmin || currentUser?.id === ue.userId;
                        const isEditing = editingExpenseId === ue.id;
                        return isEditing && editExpenseForm ? (
                          <tr
                            key={ue.id}
                            className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 bg-emerald-50/40 dark:bg-emerald-900/10"
                          >
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={editExpenseForm.date}
                                onChange={(e) =>
                                  setEditExpenseForm((f) =>
                                    f ? { ...f, date: e.target.value } : f,
                                  )
                                }
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              {ue.expenseName}
                              <input
                                type="text"
                                value={editExpenseForm.notes}
                                onChange={(e) =>
                                  setEditExpenseForm((f) =>
                                    f ? { ...f, notes: e.target.value } : f,
                                  )
                                }
                                placeholder="Notes"
                                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                              {ue.user.name}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editExpenseForm.amount}
                                onChange={(e) =>
                                  setEditExpenseForm((f) =>
                                    f ? { ...f, amount: e.target.value } : f,
                                  )
                                }
                                className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                              {(ue.expenseType === "dollar"
                                ? Number(editExpenseForm.amount || "0")
                                : (Number(editExpenseForm.amount || "0") *
                                    Number(
                                      projectExpenses.find(
                                        (pe) => pe.id === ue.projectExpenseId,
                                      )?.rateCents ?? 0,
                                    )) /
                                  100
                              ).toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditExpenseSave(ue)}
                                  disabled={savingExpense}
                                  className="text-xs text-emerald-600 hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingExpenseId(null);
                                    setEditExpenseForm(null);
                                  }}
                                  className="text-xs text-gray-500 hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={ue.id}
                            className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                          >
                            <td className="px-4 py-2.5">
                              {formatDateString(ue.date)}
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              {ue.expenseName}
                              {ue.notes && (
                                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                  {ue.notes}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                              {ue.user.name}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {ue.expenseType === "dollar"
                                ? "—"
                                : ue.quantity != null
                                  ? `${Number(ue.quantity)}${ue.expenseType === "per_km" ? " km" : " days"}`
                                  : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                              ${(ue.totalCents / 100).toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {canManage && (
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    onClick={() => startEditExpense(ue)}
                                    className="text-gray-400 hover:text-emerald-600 transition-colors"
                                    aria-label="Edit expense"
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
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api(`/user-expenses/${ue.id}`, {
                                          method: "DELETE",
                                        });
                                        addToast("Expense deleted");
                                        loadUserExpenses();
                                      } catch {
                                        addToast(
                                          "Failed to delete expense",
                                          "error",
                                        );
                                      }
                                    }}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    aria-label="Delete expense"
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
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <td
                          colSpan={4}
                          className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400"
                        >
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                          $
                          {(
                            userExpenses.reduce(
                              (sum, ue) => sum + Number(ue.totalCents ?? 0),
                              0,
                            ) / 100
                          ).toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : null}
            </section>

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
                      Task
                    </label>
                    <select
                      name="taskId"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">No task</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
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
              {entries.length > 0 && currentUser?.isAdmin && (
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

              {/* ── Summary by Task ── */}
              {tasks.length > 0 && entries.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Task
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Logged
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Budget
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Remaining
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => {
                        const logged = byTask[t.id]?.hours ?? 0;
                        const budget =
                          t.budgetHours != null ? Number(t.budgetHours) : null;
                        const remaining =
                          budget != null ? budget - logged : null;
                        const isExpanded = expandedTaskId === t.id;
                        const userBudgets = taskUserBudgets[t.id] ?? [];
                        const taskUserHours = byTaskUser[t.id] ?? {};
                        const hasPerPersonData =
                          userBudgets.length > 0 ||
                          Object.keys(taskUserHours).length > 0;
                        return (
                          <>
                            <tr
                              key={t.id}
                              className="border-b border-gray-100 dark:border-gray-700/50"
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {hasPerPersonData && (
                                    <button
                                      onClick={() =>
                                        setExpandedTaskId(
                                          isExpanded ? null : t.id,
                                        )
                                      }
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                      aria-label={
                                        isExpanded ? "Collapse" : "Expand"
                                      }
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                  {!hasPerPersonData && (
                                    <span className="w-4 inline-block" />
                                  )}
                                  {t.name}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {logged.toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {budget != null ? budget.toFixed(2) : "—"}
                              </td>
                              <td
                                className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                                  remaining != null && remaining < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : ""
                                }`}
                              >
                                {remaining != null ? remaining.toFixed(2) : "—"}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr
                                key={`${t.id}-detail`}
                                className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30"
                              >
                                <td colSpan={4} className="px-8 py-3">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-200 dark:border-gray-600">
                                        <th className="text-left pb-2 font-medium text-gray-400 dark:text-gray-500">
                                          Person
                                        </th>
                                        <th className="text-right pb-2 font-medium text-gray-400 dark:text-gray-500">
                                          Logged
                                        </th>
                                        <th className="text-right pb-2 font-medium text-gray-400 dark:text-gray-500">
                                          Budget
                                        </th>
                                        <th className="text-right pb-2 font-medium text-gray-400 dark:text-gray-500">
                                          Remaining
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const allUserIds = Array.from(
                                          new Set([
                                            ...Object.keys(taskUserHours),
                                            ...userBudgets.map(
                                              (ub) => ub.userId,
                                            ),
                                          ]),
                                        );
                                        return allUserIds.map((uid) => {
                                          const ub = userBudgets.find(
                                            (b) => b.userId === uid,
                                          );
                                          const userLogged =
                                            taskUserHours[uid] ?? 0;
                                          const userBudgetHours =
                                            ub?.budgetHours != null
                                              ? Number(ub.budgetHours)
                                              : null;
                                          const userRemaining =
                                            userBudgetHours != null
                                              ? userBudgetHours - userLogged
                                              : null;
                                          const userName =
                                            ub?.user.name ??
                                            users.find((u) => u.id === uid)
                                              ?.name ??
                                            "Unknown";
                                          return (
                                            <tr
                                              key={uid}
                                              className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                            >
                                              <td className="py-1.5 text-gray-600 dark:text-gray-300">
                                                {userName}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                                                {userLogged.toFixed(2)}
                                              </td>
                                              <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                                                {userBudgetHours != null
                                                  ? userBudgetHours.toFixed(2)
                                                  : "—"}
                                              </td>
                                              <td
                                                className={`py-1.5 text-right tabular-nums font-medium ${
                                                  userRemaining != null &&
                                                  userRemaining < 0
                                                    ? "text-red-600 dark:text-red-400"
                                                    : "text-gray-600 dark:text-gray-300"
                                                }`}
                                              >
                                                {userRemaining != null
                                                  ? userRemaining.toFixed(2)
                                                  : "—"}
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                      {byTask["_none"] && (
                        <tr className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 italic">
                            No Task
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {byTask["_none"].hours.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            —
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Individual Entries ── */}
              {(() => {
                const visibleEntries = currentUser?.isAdmin
                  ? entries
                  : entries.filter((e) => e.userId === currentUser?.id);
                return visibleEntries.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No time entries yet. Click &quot;+ Log Time&quot; to add
                    one.
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
                            Task
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
                        {visibleEntries.map((entry) => {
                          const canManageEntry =
                            (currentUser?.isAdmin ||
                              entry.userId === currentUser?.id) &&
                            !entry.locked;
                          const moveProjects = availableProjects.filter(
                            (p) => p.id !== entry.projectId,
                          );

                          return editingEntryId === entry.id &&
                            editEntryForm ? (
                            <tr
                              key={entry.id}
                              className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 bg-emerald-50/40 dark:bg-emerald-900/10"
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  value={editEntryForm.date}
                                  onChange={(e) =>
                                    setEditEntryForm((f) =>
                                      f ? { ...f, date: e.target.value } : f,
                                    )
                                  }
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={editEntryForm.taskId}
                                  onChange={(e) =>
                                    setEditEntryForm((f) =>
                                      f ? { ...f, taskId: e.target.value } : f,
                                    )
                                  }
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="">No task</option>
                                  {tasks.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                {currentUser?.isAdmin ? (
                                  <select
                                    value={editEntryForm.userId}
                                    onChange={(e) =>
                                      setEditEntryForm((f) =>
                                        f
                                          ? { ...f, userId: e.target.value }
                                          : f,
                                      )
                                    }
                                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  >
                                    {users.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-sm">
                                    {entry.user.name}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editEntryForm.description}
                                  onChange={(e) =>
                                    setEditEntryForm((f) =>
                                      f
                                        ? { ...f, description: e.target.value }
                                        : f,
                                    )
                                  }
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0.25"
                                  value={editEntryForm.hours}
                                  onChange={(e) =>
                                    setEditEntryForm((f) =>
                                      f ? { ...f, hours: e.target.value } : f,
                                    )
                                  }
                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={editEntryForm.billable}
                                  onChange={(e) =>
                                    setEditEntryForm((f) =>
                                      f
                                        ? { ...f, billable: e.target.checked }
                                        : f,
                                    )
                                  }
                                  className="accent-emerald-600"
                                />
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <button
                                  onClick={handleEditEntrySave}
                                  disabled={saving}
                                  className="text-xs rounded bg-emerald-600 text-white px-2.5 py-1 hover:bg-emerald-700 disabled:opacity-50 transition-colors mr-1"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingEntryId(null);
                                    setEditEntryForm(null);
                                  }}
                                  className="text-xs rounded border border-gray-300 px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={entry.id}
                              className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                            >
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                {formatDateString(entry.date)}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                                {entry.task?.name || "—"}
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
                                <div className="flex items-center justify-end gap-2">
                                  {movingEntryId === entry.id ? (
                                    <>
                                      <select
                                        value={moveProjectId}
                                        onChange={(e) =>
                                          setMoveProjectId(e.target.value)
                                        }
                                        className="max-w-48 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      >
                                        <option value="">Move to...</option>
                                        {moveProjects.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={handleMoveEntrySave}
                                        disabled={saving || !moveProjectId}
                                        className="text-xs rounded bg-emerald-600 text-white px-2.5 py-1 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setMovingEntryId(null);
                                          setMoveProjectId("");
                                        }}
                                        className="text-xs rounded border border-gray-300 dark:border-gray-600 px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : entry.locked ? (
                                    <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                                      Locked
                                    </span>
                                  ) : (
                                    <>
                                      {canManageEntry && (
                                        <button
                                          onClick={() => startEditEntry(entry)}
                                          className="text-gray-400 hover:text-emerald-600 transition-colors"
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
                                      {canManageEntry && (
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
                                      )}
                                      {canManageEntry && (
                                        <button
                                          onClick={() => startMoveEntry(entry)}
                                          className="text-gray-400 hover:text-emerald-600 transition-colors"
                                          aria-label="Move entry"
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                            className="h-4 w-4"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.22-3.22a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

const DOCUMENT_CATEGORIES = [
  "Project Management",
  "Correspondence",
  "Reference Documents",
  "Reporting",
  "Data",
  "Mapping",
] as const;

function CategoryDropzone({
  category,
  projectId,
  documents,
  onUploadComplete,
  onDelete,
}: {
  category: string;
  projectId: string;
  documents: DocumentWithDetails[];
  onUploadComplete: () => void;
  onDelete: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("projectId", projectId);
        fd.append("category", category);
        await apiUpload<ApiResponse<DocumentWithDetails>>(
          "/documents/upload",
          fd,
        );
      }
      addToast(
        `${files.length === 1 ? "File" : "Files"} uploaded to ${category}`,
      );
      onUploadComplete();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
        dragging
          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      }`}
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {category}
      </h3>

      {documents.length > 0 && (
        <ul className="space-y-1 mb-3">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 text-xs group">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-gray-400"
              >
                <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
              </svg>
              <a
                href={doc.googleDriveUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                {doc.name}
              </a>
              <button
                onClick={() => onDelete(doc.id)}
                className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                aria-label="Delete document"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex flex-col items-center cursor-pointer text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
        {uploading ? (
          <span className="text-xs">Uploading…</span>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6 mb-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
            <span className="text-xs">Drop files or click to upload</span>
          </>
        )}
        <input
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: DocumentWithDetails;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-8 w-8 shrink-0 ${
          doc.mimeType?.includes("spreadsheet")
            ? "text-green-500"
            : doc.mimeType?.includes("presentation")
              ? "text-yellow-500"
              : doc.mimeType?.includes("pdf")
                ? "text-red-500"
                : doc.mimeType?.includes("image")
                  ? "text-purple-500"
                  : "text-blue-500"
        }`}
      >
        <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
      </svg>
      <div className="min-w-0 flex-1">
        <a
          href={doc.googleDriveUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block"
        >
          {doc.name}
          <span className="ml-1.5 text-gray-400 text-xs">↗</span>
        </a>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Added by {doc.uploadedByName} ·{" "}
          {new Date(doc.createdAt).toLocaleDateString()}
          {doc.category && (
            <span className="ml-2 text-gray-400">· {doc.category}</span>
          )}
        </p>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
        aria-label="Remove document"
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
  );
}
