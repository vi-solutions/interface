"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, apiUpload } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import type {
  ApiListResponse,
  ApiResponse,
  UserExpenseWithDetails,
  ProjectWithClient,
  ProjectExpense,
  CreateUserExpenseDto,
  UpdateUserExpenseDto,
} from "@interface/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface EditExpenseState {
  date: string;
  value: string; // dollar amount (dollars) or quantity (km/days)
  notes: string;
}

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

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function expenseLabel(e: UserExpenseWithDetails) {
  if (e.expenseType === "dollar") return fmtMoney(Number(e.totalCents));
  if (e.expenseType === "per_km")
    return `${Math.round(Number(e.quantity ?? 0))} km`;
  return `${Math.round(Number(e.quantity ?? 0))} days`;
}

export default function MobileExpensesPage() {
  const { authenticated, user } = useRequireAuth();
  const { addToast } = useToast();

  const [expenses, setExpenses] = useState<UserExpenseWithDetails[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPE, setSelectedPE] = useState<ProjectExpense | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditExpenseState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const newReceiptRef = useRef<HTMLInputElement>(null);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);

  const loadExpenses = useCallback(() => {
    if (!user) return;
    api<ApiListResponse<UserExpenseWithDetails>>(
      `/user-expenses?userId=${user.id}`,
    )
      .then((r) => setExpenses(r.data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!authenticated || !user) return;
    loadExpenses();
    api<ApiListResponse<ProjectWithClient>>("/projects")
      .then((r) => setProjects(r.data))
      .catch(() => {});
  }, [authenticated, user, loadExpenses]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectExpenses([]);
      setSelectedPE(null);
      return;
    }
    api<ApiListResponse<ProjectExpense>>(
      `/project-expenses?projectId=${selectedProjectId}`,
    )
      .then((r) => {
        setProjectExpenses(r.data);
        setSelectedPE(r.data[0] ?? null);
      })
      .catch(() => {
        setProjectExpenses([]);
        setSelectedPE(null);
      });
  }, [selectedProjectId]);

  if (!authenticated || !user) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPE) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const valueStr = form.get("amount") as string;
    const isDollarType = selectedPE.type === "dollar";
    const value = isDollarType
      ? parseFloat(valueStr)
      : Math.round(parseInt(valueStr, 10));

    let totalCents: number;
    let quantity: number | undefined;

    if (isDollarType) {
      totalCents = Math.round(value * 100);
    } else {
      quantity = value;
      totalCents = Math.round(value * selectedPE.rateCents);
    }

    const dto: CreateUserExpenseDto = {
      projectId: selectedProjectId,
      userId: user!.id,
      projectExpenseId: selectedPE.id,
      date: form.get("date") as string,
      quantity,
      totalCents,
      notes: (form.get("notes") as string) || undefined,
    };
    try {
      const created = await api<ApiResponse<UserExpenseWithDetails>>(
        "/user-expenses",
        {
          method: "POST",
          body: JSON.stringify(dto),
        },
      );
      if (newReceiptFile) {
        setReceiptUploading(true);
        try {
          const fd = new FormData();
          fd.append("file", newReceiptFile);
          await apiUpload<ApiResponse<{ receiptUrl: string }>>(
            `/user-expenses/${created.data.id}/receipt`,
            fd,
          );
        } catch {
          addToast("Expense added but receipt upload failed", "error");
        } finally {
          setReceiptUploading(false);
        }
      }
      addToast("Expense added");
      setShowForm(false);
      setSelectedProjectId("");
      setSelectedPE(null);
      setNewReceiptFile(null);
      if (newReceiptRef.current) newReceiptRef.current.value = "";
      loadExpenses();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to save expense",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(exp: UserExpenseWithDetails) {
    setEditingId(exp.id);
    const isDollar = exp.expenseType === "dollar";
    setEditState({
      date: exp.date.slice(0, 10),
      value: isDollar
        ? (Number(exp.totalCents) / 100).toFixed(2)
        : String(Math.round(Number(exp.quantity ?? 0))),
      notes: exp.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function handleSaveEdit(exp: UserExpenseWithDetails) {
    if (!editState) return;
    setEditSaving(true);
    const value =
      exp.expenseType === "dollar"
        ? parseFloat(editState.value)
        : Math.round(parseInt(editState.value, 10));
    let totalCents: number;
    let quantity: number | undefined;
    if (exp.expenseType === "dollar") {
      totalCents = Math.round(value * 100);
    } else {
      quantity = value;
      const rateCents = Math.round(
        Number(exp.totalCents) / (Number(exp.quantity) || 1),
      );
      totalCents = Math.round(value * rateCents);
    }
    const dto: UpdateUserExpenseDto = {
      date: editState.date,
      quantity,
      totalCents,
      notes: editState.notes || undefined,
    };
    try {
      await api<ApiResponse<UserExpenseWithDetails>>(
        `/user-expenses/${exp.id}`,
        { method: "PUT", body: JSON.stringify(dto) },
      );
      addToast("Expense updated");
      cancelEdit();
      loadExpenses();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update expense",
        "error",
      );
    } finally {
      setEditSaving(false);
    }
  }

  async function handleReceiptCapture(
    expenseId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiUpload<ApiResponse<{ receiptUrl: string }>>(
        `/user-expenses/${expenseId}/receipt`,
        fd,
      );
      addToast("Receipt saved");
      loadExpenses();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to upload receipt",
        "error",
      );
    } finally {
      setReceiptUploading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/user-expenses/${id}`, { method: "DELETE" });
      addToast("Expense deleted");
      loadExpenses();
    } catch {
      addToast("Failed to delete expense", "error");
    }
  }

  const inputLabel =
    selectedPE?.type === "dollar"
      ? "Amount ($)"
      : selectedPE?.type === "per_km"
        ? `Distance (km) — ${fmtMoney(selectedPE?.rateCents ?? 0)}/km`
        : `Days — ${fmtMoney(selectedPE?.rateCents ?? 0)}/day`;

  // Group expenses by project
  const byProject = expenses.reduce<
    Record<
      string,
      { name: string; total: number; items: UserExpenseWithDetails[] }
    >
  >((acc, exp) => {
    const proj = projects.find((p) => p.id === exp.projectId);
    const name = proj?.name ?? "Unknown Project";
    if (!acc[exp.projectId]) acc[exp.projectId] = { name, total: 0, items: [] };
    acc[exp.projectId].total += Number(exp.totalCents);
    acc[exp.projectId].items.push(exp);
    return acc;
  }, {});
  const sortedProjects = Object.entries(byProject).sort(
    ([, a], [, b]) => b.total - a.total,
  );

  return (
    <div className="px-4 pt-8 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Expenses
        </h1>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            cancelEdit();
          }}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700"
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && !editingId && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

          {projectExpenses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expense Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedPE?.id ?? ""}
                onChange={(e) =>
                  setSelectedPE(
                    projectExpenses.find((pe) => pe.id === e.target.value) ??
                      null,
                  )
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {projectExpenses.map((pe) => (
                  <option key={pe.id} value={pe.id}>
                    {pe.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedProjectId && projectExpenses.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">
              No expense types configured for this project.
            </p>
          )}

          {selectedPE && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={todayStr()}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {inputLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    required
                    min="0"
                    step={selectedPE.type === "dollar" ? "0.01" : "1"}
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Optional notes…"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receipt
                </label>
                <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-700/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-5 shrink-0"
                  >
                    <path
                      fillRule="evenodd"
                      d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="flex-1 truncate">
                    {newReceiptFile
                      ? newReceiptFile.name
                      : "Take photo or choose image"}
                  </span>
                  {newReceiptFile && (
                    <span
                      role="button"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={(e) => {
                        e.preventDefault();
                        setNewReceiptFile(null);
                        if (newReceiptRef.current)
                          newReceiptRef.current.value = "";
                      }}
                    >
                      ✕
                    </span>
                  )}
                  <input
                    ref={newReceiptRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) =>
                      setNewReceiptFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={saving || receiptUploading}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
              >
                {saving
                  ? "Saving…"
                  : receiptUploading
                    ? "Uploading receipt…"
                    : "Add Expense"}
              </button>
            </>
          )}
        </form>
      )}

      {/* Expenses list */}
      {expenses.length === 0 && !showForm && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
          No expenses yet.
        </div>
      )}

      {sortedProjects.map(([projectId, group]) => (
        <div key={projectId} className="mb-4">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate pr-2">
              {group.name}
            </p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
              {fmtMoney(group.total)}
            </p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
            {group.items.map((exp) => {
              const isEditing = editingId === exp.id;
              const isDollar = exp.expenseType === "dollar";
              const valueLabel = isDollar
                ? "Amount ($)"
                : exp.expenseType === "per_km"
                  ? "Distance (km)"
                  : "Days";

              if (isEditing && editState) {
                return (
                  <div
                    key={exp.id}
                    className="p-4 space-y-3 bg-emerald-50 dark:bg-emerald-950/20"
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {exp.expenseName}
                    </p>
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
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {valueLabel}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step={isDollar ? "0.01" : "1"}
                          value={editState.value}
                          onChange={(e) =>
                            setEditState(
                              (s) => s && { ...s, value: e.target.value },
                            )
                          }
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Notes
                      </label>
                      <textarea
                        rows={2}
                        value={editState.notes}
                        onChange={(e) =>
                          setEditState(
                            (s) => s && { ...s, notes: e.target.value },
                          )
                        }
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>

                    {/* Receipt */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Receipt
                      </label>
                      {exp.receiptUrl ? (
                        <div className="flex items-center gap-3">
                          <a
                            href={`${API_BASE}${exp.receiptUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`${API_BASE}${exp.receiptUrl}`}
                              alt="Receipt"
                              className="h-16 w-16 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                            />
                          </a>
                          <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="size-4"
                            >
                              <path d="M1 12.5A4.5 4.5 0 0 0 5.5 17H15a3 3 0 0 0 1.131-5.765 4.5 4.5 0 0 0-8.949-1.218A4 4 0 1 0 1 12.5Zm6.432-3.108a.75.75 0 0 1 1.136 0l2 2.25a.75.75 0 1 1-1.136.984L9 11.31V15a.75.75 0 0 1-1.5 0v-3.69l-.432.316a.75.75 0 1 1-.136-.984l2-2.25Z" />
                            </svg>
                            {receiptUploading ? "Uploading…" : "Replace"}
                            <input
                              ref={receiptInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              disabled={receiptUploading}
                              onChange={(e) => handleReceiptCapture(exp.id, e)}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-700/30">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-5 shrink-0"
                          >
                            <path
                              fillRule="evenodd"
                              d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {receiptUploading
                            ? "Uploading…"
                            : "Take photo or choose image"}
                          <input
                            ref={receiptInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={receiptUploading}
                            onChange={(e) => handleReceiptCapture(exp.id, e)}
                          />
                        </label>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleSaveEdit(exp)}
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
                          handleDelete(exp.id);
                        }}
                        className="rounded-xl border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20"
                        aria-label="Delete expense"
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
                <button
                  key={exp.id}
                  onClick={() => {
                    setShowForm(false);
                    startEdit(exp);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-700/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {exp.expenseName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {fmtDate(exp.date)}
                      {exp.notes && ` · ${exp.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {fmtMoney(Number(exp.totalCents))}
                      </p>
                      <p className="text-xs text-gray-400">
                        {expenseLabel(exp)}
                      </p>
                    </div>
                    {exp.receiptUrl && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-4 text-emerald-500 shrink-0"
                      >
                        <path
                          fillRule="evenodd"
                          d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="size-4 text-gray-400"
                    >
                      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
