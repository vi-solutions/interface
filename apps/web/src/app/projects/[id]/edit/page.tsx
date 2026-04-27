"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  Client,
  ProjectWithClient,
  UpdateProjectDto,
  ProjectPhase,
  ProjectStatus,
  User,
  ProjectExpense,
  CreateProjectExpenseDto,
  ExpenseType,
  Expense,
  Milestone,
  CreateMilestoneDto,
  Contact,
  ProjectContactWithDetails,
  Task,
  CreateTaskDto,
  ProjectUserRateWithUser,
  CreateProjectUserRateDto,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  FormField,
  Input,
  Select,
  Textarea,
  Button,
  ErrorAlert,
} from "@/components/ui";

export default function EditProjectPage() {
  const { authenticated } = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState("");
  const [globalExpenses, setGlobalExpenses] = useState<Expense[]>([]);
  const [expenseMode, setExpenseMode] = useState<"existing" | "custom">(
    "existing",
  );
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(
    null,
  );
  const [editingMilestoneName, setEditingMilestoneName] = useState("");
  const [editingMilestoneDate, setEditingMilestoneDate] = useState("");
  const [projectContacts, setProjectContacts] = useState<
    ProjectContactWithDetails[]
  >([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [savingContact, setSavingContact] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [projectUserRates, setProjectUserRates] = useState<
    ProjectUserRateWithUser[]
  >([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingHourly, setEditingHourly] = useState("");
  const [editingDaily, setEditingDaily] = useState("");

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

  const loadTasks = useCallback(() => {
    api<ApiListResponse<Task>>(`/tasks?projectId=${id}`)
      .then((res) => setTasks(res.data))
      .catch(() => {});
  }, [id]);

  const loadProjectUserRates = useCallback(() => {
    api<ApiListResponse<ProjectUserRateWithUser>>(
      `/project-user-rates?projectId=${id}`,
    )
      .then((res) => setProjectUserRates(res.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<ProjectWithClient>>(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load project"),
      );
    api<ApiListResponse<Client>>("/clients")
      .then((res) => setClients(res.data))
      .catch(() => {});
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
      .catch(() => {});
    api<ApiListResponse<Expense>>("/expenses")
      .then((res) => setGlobalExpenses(res.data))
      .catch(() => {});
    loadProjectExpenses();
    loadMilestones();
    loadProjectContacts();
    loadTasks();
    loadProjectUserRates();
    api<ApiListResponse<Contact>>("/contacts")
      .then((res) => setAllContacts(res.data))
      .catch(() => {});
  }, [
    authenticated,
    id,
    loadProjectExpenses,
    loadMilestones,
    loadProjectContacts,
    loadTasks,
    loadProjectUserRates,
  ]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const budgetStr = form.get("budget") as string;
    const dto: UpdateProjectDto = {
      clientId: form.get("clientId") as string,
      name: form.get("name") as string,
      code: (form.get("code") as string) || undefined,
      description: (form.get("description") as string) || undefined,
      status: (form.get("status") as ProjectStatus) || undefined,
      phase: ((form.get("phase") as string) || undefined) as
        | ProjectPhase
        | undefined,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      budgetCents: budgetStr
        ? Math.round(parseFloat(budgetStr) * 100)
        : undefined,
      budgetHours: (() => {
        const s = form.get("budgetHours") as string;
        return s ? parseFloat(s) : undefined;
      })(),
      projectManagerId: (form.get("projectManagerId") as string) || undefined,
    };

    try {
      await api<ApiResponse<ProjectWithClient>>(`/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      addToast("Project updated successfully");
      router.push(`/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href={`/projects/${id}`}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ← Back to Project
          </Link>
        </div>

        <PageHeader title="Edit Project" />

        {error && <ErrorAlert message={error} />}

        {(!project || clients.length === 0) && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && clients.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Client" htmlFor="clientId" required>
              <Select
                id="clientId"
                name="clientId"
                required
                defaultValue={project.clientId}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Project Name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                required
                defaultValue={project.name}
              />
            </FormField>

            <FormField label="Project Code" htmlFor="code">
              <Input
                id="code"
                name="code"
                placeholder="e.g. 2026-99-001"
                defaultValue={project.code ?? ""}
              />
            </FormField>

            <FormField label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project.description ?? ""}
              />
            </FormField>

            <FormField label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={project.status}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>

            <FormField label="Phase" htmlFor="phase">
              <Select
                id="phase"
                name="phase"
                defaultValue={project.phase ?? ""}
              >
                <option value="">None</option>
                <option value="assessment">Assessment</option>
                <option value="analysis">Analysis</option>
                <option value="restoration">Restoration</option>
                <option value="permitting">Permitting</option>
                <option value="reporting">Reporting</option>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" htmlFor="startDate">
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={project.startDate?.slice(0, 10) ?? ""}
                />
              </FormField>
              <FormField label="End Date" htmlFor="endDate">
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={project.endDate?.slice(0, 10) ?? ""}
                />
              </FormField>
            </div>

            <FormField label="Budget ($)" htmlFor="budget">
              <Input
                id="budget"
                name="budget"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  project.budgetCents != null
                    ? (project.budgetCents / 100).toFixed(2)
                    : ""
                }
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Budget (hours)" htmlFor="budgetHours">
              <Input
                id="budgetHours"
                name="budgetHours"
                type="number"
                step="0.5"
                min="0"
                defaultValue={
                  project.budgetHours != null ? String(project.budgetHours) : ""
                }
                placeholder="e.g. 200"
              />
            </FormField>

            <FormField label="Project Manager" htmlFor="projectManagerId">
              <Select
                id="projectManagerId"
                name="projectManagerId"
                defaultValue={project.projectManagerId ?? ""}
              >
                <option value="">None</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/projects/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* ── Project Expenses ──────────────────────────────── */}
        {project && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Expenses</h2>
              <button
                onClick={() => setShowExpenseForm((v) => !v)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                {showExpenseForm ? "Cancel" : "+ Add Expense"}
              </button>
            </div>

            {showExpenseForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingExpense(true);
                  const form = new FormData(e.currentTarget);
                  let dto: CreateProjectExpenseDto;

                  if (expenseMode === "existing") {
                    const expenseId = form.get("expenseId") as string;
                    const rateStr = form.get("rateCents") as string;
                    dto = {
                      projectId: id,
                      expenseId,
                      rateCents: rateStr
                        ? Math.round(parseFloat(rateStr) * 100)
                        : 0,
                    };
                  } else {
                    const rateStr = form.get("rateCents") as string;
                    dto = {
                      projectId: id,
                      name: form.get("name") as string,
                      type: form.get("type") as ExpenseType,
                      description:
                        (form.get("description") as string) || undefined,
                      rateCents: rateStr
                        ? Math.round(parseFloat(rateStr) * 100)
                        : 0,
                    };
                  }
                  try {
                    await api<ApiResponse<ProjectExpense>>(
                      "/project-expenses",
                      {
                        method: "POST",
                        body: JSON.stringify(dto),
                      },
                    );
                    addToast("Expense added");
                    setShowExpenseForm(false);
                    loadProjectExpenses();
                  } catch (err) {
                    addToast(
                      err instanceof Error
                        ? err.message
                        : "Failed to add expense",
                      "error",
                    );
                  } finally {
                    setSavingExpense(false);
                  }
                }}
                className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4"
              >
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="mode"
                      checked={expenseMode === "existing"}
                      onChange={() => setExpenseMode("existing")}
                      className="accent-emerald-600"
                    />
                    From existing
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="mode"
                      checked={expenseMode === "custom"}
                      onChange={() => setExpenseMode("custom")}
                      className="accent-emerald-600"
                    />
                    Create new
                  </label>
                </div>

                {expenseMode === "existing" ? (
                  (() => {
                    const available = globalExpenses.filter(
                      (ge) =>
                        ge.type !== "dollar" &&
                        !projectExpenses.some((pe) => pe.expenseId === ge.id),
                    );
                    return available.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        All global expenses have already been added to this
                        project. You can create a new custom expense instead.
                      </p>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Expense <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="expenseId"
                          required
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="">Select an expense…</option>
                          {available.map((ge) => (
                            <option key={ge.id} value={ge.id}>
                              {ge.name} ({ge.type.replace("_", " ")})
                            </option>
                          ))}
                        </select>
                        <div className="mt-3">
                          <label className="block text-sm font-medium mb-1">
                            Rate ($) <span className="text-red-500">*</span>
                          </label>
                          <input
                            name="rateCents"
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            placeholder="0.00"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="name"
                        required
                        placeholder="e.g. Mileage"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="type"
                        required
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="dollar">Dollar</option>
                        <option value="per_km">Per KM</option>
                        <option value="per_day">Per Day</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Rate ($)
                      </label>
                      <input
                        name="rateCents"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        Description
                      </label>
                      <input
                        name="description"
                        placeholder="Optional description"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {savingExpense ? "Adding…" : "Add Expense"}
                  </button>
                </div>
              </form>
            )}

            {projectExpenses.length === 0 && !showExpenseForm ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No expenses configured for this project.
              </p>
            ) : projectExpenses.length > 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Name
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Type
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Rate
                      </th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectExpenses.map((pe) => (
                      <tr
                        key={pe.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <td className="px-4 py-2.5 font-medium">{pe.name}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 capitalize">
                          {pe.type.replace("_", " ")}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {pe.type === "dollar" ? (
                            <span className="text-gray-400">—</span>
                          ) : editingExpenseId === pe.id ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={editingRate}
                              onChange={(e) => setEditingRate(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === "Escape") {
                                  setEditingExpenseId(null);
                                }
                              }}
                              onBlur={async () => {
                                const newCents = Math.round(
                                  parseFloat(editingRate) * 100,
                                );
                                if (
                                  isNaN(newCents) ||
                                  newCents === pe.rateCents
                                ) {
                                  setEditingExpenseId(null);
                                  return;
                                }
                                try {
                                  await api<ApiResponse<ProjectExpense>>(
                                    `/project-expenses/${pe.id}`,
                                    {
                                      method: "PUT",
                                      body: JSON.stringify({
                                        rateCents: newCents,
                                      }),
                                    },
                                  );
                                  addToast("Rate updated");
                                  loadProjectExpenses();
                                } catch {
                                  addToast("Failed to update rate", "error");
                                }
                                setEditingExpenseId(null);
                              }}
                              className="w-24 ml-auto rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingExpenseId(pe.id);
                                setEditingRate((pe.rateCents / 100).toFixed(2));
                              }}
                              className="inline-flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              title="Click to edit rate"
                            >
                              ${(pe.rateCents / 100).toFixed(2)}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="h-3 w-3 opacity-40"
                              >
                                <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.303a1 1 0 0 0-.258.46l-.67 2.68a.75.75 0 0 0 .915.915l2.68-.67a1 1 0 0 0 .46-.258l7.79-7.793a1.75 1.75 0 0 0 0-2.475l-.649-.649Z" />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={async () => {
                              try {
                                await api(`/project-expenses/${pe.id}`, {
                                  method: "DELETE",
                                });
                                addToast("Expense removed");
                                loadProjectExpenses();
                              } catch {
                                addToast("Failed to remove expense", "error");
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            aria-label="Remove expense"
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
            ) : null}
          </section>
        )}

        {/* ── Milestones ──────────────────────────────────── */}
        {project && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Milestones</h2>
              <button
                onClick={() => setShowMilestoneForm((v) => !v)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                {showMilestoneForm ? "Cancel" : "+ Add Milestone"}
              </button>
            </div>

            {showMilestoneForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingMilestone(true);
                  const form = new FormData(e.currentTarget);
                  const dto: CreateMilestoneDto = {
                    projectId: id,
                    name: form.get("name") as string,
                    date: (form.get("date") as string) || undefined,
                  };
                  try {
                    await api<ApiResponse<Milestone>>("/milestones", {
                      method: "POST",
                      body: JSON.stringify(dto),
                    });
                    addToast("Milestone added");
                    setShowMilestoneForm(false);
                    loadMilestones();
                  } catch (err) {
                    addToast(
                      err instanceof Error
                        ? err.message
                        : "Failed to add milestone",
                      "error",
                    );
                  } finally {
                    setSavingMilestone(false);
                  }
                }}
                className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Phase 1 — Design"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    name="date"
                    type="date"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingMilestone}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {savingMilestone ? "Adding…" : "Add Milestone"}
                  </button>
                </div>
              </form>
            )}

            {milestones.length === 0 && !showMilestoneForm ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No milestones configured for this project.
              </p>
            ) : milestones.length > 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Name
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((ms) => (
                      <tr
                        key={ms.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <td className="px-4 py-2.5 font-medium">
                          {editingMilestoneId === ms.id ? (
                            <input
                              autoFocus
                              value={editingMilestoneName}
                              onChange={(e) =>
                                setEditingMilestoneName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Escape")
                                  setEditingMilestoneId(null);
                              }}
                              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          ) : (
                            ms.name
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {editingMilestoneId === ms.id ? (
                            <input
                              type="date"
                              value={editingMilestoneDate}
                              onChange={(e) =>
                                setEditingMilestoneDate(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Escape")
                                  setEditingMilestoneId(null);
                              }}
                              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          ) : ms.date ? (
                            new Date(ms.date).toLocaleDateString("en-CA")
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editingMilestoneId !== ms.id && (
                              <button
                                onClick={() => {
                                  setEditingMilestoneId(ms.id);
                                  setEditingMilestoneName(ms.name);
                                  setEditingMilestoneDate(
                                    ms.date?.slice(0, 10) ?? "",
                                  );
                                }}
                                className="text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                title="Edit"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                  className="h-4 w-4"
                                >
                                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.303a1 1 0 0 0-.258.46l-.67 2.68a.75.75 0 0 0 .915.915l2.68-.67a1 1 0 0 0 .46-.258l7.79-7.793a1.75 1.75 0 0 0 0-2.475l-.649-.649Z" />
                                </svg>
                              </button>
                            )}
                            {editingMilestoneId === ms.id && (
                              <button
                                onClick={async () => {
                                  try {
                                    await api<ApiResponse<Milestone>>(
                                      `/milestones/${ms.id}`,
                                      {
                                        method: "PUT",
                                        body: JSON.stringify({
                                          name: editingMilestoneName,
                                          date: editingMilestoneDate || null,
                                        }),
                                      },
                                    );
                                    addToast("Milestone updated");
                                    setEditingMilestoneId(null);
                                    loadMilestones();
                                  } catch {
                                    addToast(
                                      "Failed to update milestone",
                                      "error",
                                    );
                                  }
                                }}
                                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors text-sm font-medium"
                              >
                                Save
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await api(`/milestones/${ms.id}`, {
                                    method: "DELETE",
                                  });
                                  addToast("Milestone removed");
                                  loadMilestones();
                                } catch {
                                  addToast(
                                    "Failed to remove milestone",
                                    "error",
                                  );
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Remove milestone"
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        )}

        {/* ── Tasks ──────────────────────────────────────── */}
        {project && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <button
                onClick={() => setShowTaskForm((v) => !v)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                {showTaskForm ? "Cancel" : "+ Add Task"}
              </button>
            </div>

            {showTaskForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingTask(true);
                  const form = new FormData(e.currentTarget);
                  const budgetStr = form.get("budgetHours") as string;
                  const dto: CreateTaskDto = {
                    projectId: id,
                    name: form.get("name") as string,
                    description:
                      (form.get("description") as string) || undefined,
                    budgetHours: budgetStr ? parseFloat(budgetStr) : undefined,
                  };
                  try {
                    await api<ApiResponse<Task>>("/tasks", {
                      method: "POST",
                      body: JSON.stringify(dto),
                    });
                    addToast("Task added");
                    setShowTaskForm(false);
                    loadTasks();
                  } catch (err) {
                    addToast(
                      err instanceof Error ? err.message : "Failed to add task",
                      "error",
                    );
                  } finally {
                    setSavingTask(false);
                  }
                }}
                className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Site Visit"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Budget (hours)
                  </label>
                  <input
                    name="budgetHours"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 40"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <input
                    name="description"
                    placeholder="Optional description"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingTask}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {savingTask ? "Adding…" : "Add Task"}
                  </button>
                </div>
              </form>
            )}

            {tasks.length === 0 && !showTaskForm ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No tasks configured for this project.
              </p>
            ) : tasks.length > 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Name
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Budget
                      </th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{t.name}</p>
                          {t.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                          {t.budgetHours != null
                            ? `${Number(t.budgetHours)}h`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={async () => {
                              try {
                                await api(`/tasks/${t.id}`, {
                                  method: "DELETE",
                                });
                                addToast("Task removed");
                                loadTasks();
                              } catch {
                                addToast("Failed to remove task", "error");
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            aria-label="Remove task"
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
            ) : null}
          </section>
        )}

        {/* ── Team Rates ──────────────────────────────── */}
        {project && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Team Rates</h2>
              <button
                onClick={() => setShowRateForm((v) => !v)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                {showRateForm ? "Cancel" : "+ Add Member"}
              </button>
            </div>

            {showRateForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingRate(true);
                  const form = new FormData(e.currentTarget);
                  const hourlyStr = form.get("hourlyRate") as string;
                  const dailyStr = form.get("dailyRate") as string;
                  const dto: CreateProjectUserRateDto = {
                    projectId: id,
                    userId: form.get("userId") as string,
                    hourlyRateCents: hourlyStr
                      ? Math.round(parseFloat(hourlyStr) * 100)
                      : undefined,
                    dailyRateCents: dailyStr
                      ? Math.round(parseFloat(dailyStr) * 100)
                      : undefined,
                  };
                  try {
                    await api<ApiResponse<ProjectUserRateWithUser>>(
                      "/project-user-rates",
                      { method: "POST", body: JSON.stringify(dto) },
                    );
                    addToast("Team member added");
                    setShowRateForm(false);
                    loadProjectUserRates();
                  } catch (err) {
                    addToast(
                      err instanceof Error
                        ? err.message
                        : "Failed to add team member",
                      "error",
                    );
                  } finally {
                    setSavingRate(false);
                  }
                }}
                className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-3"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Team Member <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="userId"
                    required
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select…</option>
                    {users
                      .filter(
                        (u) => !projectUserRates.some((r) => r.userId === u.id),
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Hourly Rate ($)
                  </label>
                  <input
                    name="hourlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Daily Rate ($)
                  </label>
                  <input
                    name="dailyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={savingRate}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {savingRate ? "Adding…" : "Add Member"}
                  </button>
                </div>
              </form>
            )}

            {projectUserRates.length === 0 && !showRateForm ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No team members assigned. Add members to set project-specific
                charge-out rates.
              </p>
            ) : projectUserRates.length > 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Team Member
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Hourly Rate
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Daily Rate
                      </th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectUserRates.map((pur) => {
                      const isEditing = editingRateId === pur.id;
                      return (
                        <tr
                          key={pur.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {pur.user.name}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={editingHourly}
                                onChange={(e) =>
                                  setEditingHourly(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Escape")
                                    setEditingRateId(null);
                                }}
                                placeholder="—"
                                className="w-24 ml-auto rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            ) : pur.hourlyRateCents != null ? (
                              <span className="font-medium">
                                $
                                {(Number(pur.hourlyRateCents) / 100).toFixed(2)}
                                /hr
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingDaily}
                                onChange={(e) =>
                                  setEditingDaily(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Escape")
                                    setEditingRateId(null);
                                }}
                                placeholder="—"
                                className="w-24 ml-auto rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            ) : pur.dailyRateCents != null ? (
                              <span className="font-medium">
                                ${(Number(pur.dailyRateCents) / 100).toFixed(2)}
                                /day
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api(
                                        `/project-user-rates/${pur.id}`,
                                        {
                                          method: "PUT",
                                          body: JSON.stringify({
                                            hourlyRateCents: editingHourly
                                              ? Math.round(
                                                  parseFloat(editingHourly) *
                                                    100,
                                                )
                                              : null,
                                            dailyRateCents: editingDaily
                                              ? Math.round(
                                                  parseFloat(editingDaily) *
                                                    100,
                                                )
                                              : null,
                                          }),
                                        },
                                      );
                                      addToast("Rates updated");
                                      setEditingRateId(null);
                                      loadProjectUserRates();
                                    } catch {
                                      addToast(
                                        "Failed to update rates",
                                        "error",
                                      );
                                    }
                                  }}
                                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors text-sm font-medium"
                                >
                                  Save
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingRateId(pur.id);
                                    setEditingHourly(
                                      pur.hourlyRateCents != null
                                        ? (
                                            Number(pur.hourlyRateCents) / 100
                                          ).toFixed(2)
                                        : "",
                                    );
                                    setEditingDaily(
                                      pur.dailyRateCents != null
                                        ? (
                                            Number(pur.dailyRateCents) / 100
                                          ).toFixed(2)
                                        : "",
                                    );
                                  }}
                                  className="text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                  title="Edit rates"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                    className="h-4 w-4"
                                  >
                                    <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.303a1 1 0 0 0-.258.46l-.67 2.68a.75.75 0 0 0 .915.915l2.68-.67a1 1 0 0 0 .46-.258l7.79-7.793a1.75 1.75 0 0 0 0-2.475l-.649-.649Z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  try {
                                    await api(`/project-user-rates/${pur.id}`, {
                                      method: "DELETE",
                                    });
                                    addToast("Team member removed");
                                    loadProjectUserRates();
                                  } catch {
                                    addToast(
                                      "Failed to remove team member",
                                      "error",
                                    );
                                  }
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                aria-label="Remove team member"
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        )}

        {/* ── Project Contacts ──────────────────────────── */}
        {project && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Contacts</h2>
            </div>

            {(() => {
              const assignedIds = new Set(
                projectContacts.map((pc) => pc.contactId),
              );
              const available = allContacts.filter(
                (c) => !assignedIds.has(c.id),
              );
              return available.length > 0 ? (
                <div className="mb-4 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      Add a contact
                    </label>
                    <select
                      id="addContactSelect"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select contact…</option>
                      {available.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.agency ? ` — ${c.agency}` : ""}
                          {c.title ? ` (${c.title})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={savingContact}
                    onClick={async () => {
                      const sel = document.getElementById(
                        "addContactSelect",
                      ) as HTMLSelectElement;
                      const contactId = sel.value;
                      if (!contactId) return;
                      setSavingContact(true);
                      try {
                        await api("/project-contacts", {
                          method: "POST",
                          body: JSON.stringify({
                            projectId: id,
                            contactId,
                          }),
                        });
                        addToast("Contact added to project");
                        loadProjectContacts();
                        sel.value = "";
                      } catch {
                        addToast("Failed to add contact", "error");
                      } finally {
                        setSavingContact(false);
                      }
                    }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {savingContact ? "Adding…" : "Add"}
                  </button>
                </div>
              ) : allContacts.length === 0 ? (
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  No contacts exist yet.{" "}
                  <a
                    href="/contacts"
                    className="text-emerald-600 hover:underline"
                  >
                    Add contacts on the Contacts page
                  </a>
                  .
                </p>
              ) : (
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  All contacts are already assigned to this project.
                </p>
              );
            })()}

            {projectContacts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No contacts assigned to this project.
              </p>
            ) : (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Name
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Agency
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Title
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Email
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                        Phone
                      </th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {projectContacts.map((pc) => (
                      <tr
                        key={pc.id}
                        className="border-b border-gray-100 dark:border-gray-700/50"
                      >
                        <td className="px-4 py-2.5 font-medium">
                          {pc.contact.name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                          {pc.contact.agency || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                          {pc.contact.title || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                          {pc.contact.email ? (
                            <a
                              href={`mailto:${pc.contact.email}`}
                              className="hover:underline"
                            >
                              {pc.contact.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                          {pc.contact.phone || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={async () => {
                              try {
                                await api(`/project-contacts/${pc.id}`, {
                                  method: "DELETE",
                                });
                                addToast("Contact removed from project");
                                loadProjectContacts();
                              } catch {
                                addToast("Failed to remove contact", "error");
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            aria-label="Remove contact"
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
        )}
      </div>
    </AppShell>
  );
}
