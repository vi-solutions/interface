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

  const loadProjectExpenses = useCallback(() => {
    api<ApiListResponse<ProjectExpense>>(`/project-expenses?projectId=${id}`)
      .then((res) => setProjectExpenses(res.data))
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
  }, [authenticated, id, loadProjectExpenses]);

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
      <div className="max-w-2xl mx-auto p-8">
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

        {!project && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && (
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
                  defaultValue={project.startDate ?? ""}
                />
              </FormField>
              <FormField label="End Date" htmlFor="endDate">
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={project.endDate ?? ""}
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
      </div>
    </AppShell>
  );
}
