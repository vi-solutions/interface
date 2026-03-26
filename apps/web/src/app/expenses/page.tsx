"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ApiListResponse,
  ApiResponse,
  Expense,
  CreateExpenseDto,
  ExpenseType,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  Card,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  EmptyState,
  ErrorAlert,
} from "@/components/ui";

const TYPE_LABELS: Record<ExpenseType, string> = {
  dollar: "Dollar",
  per_km: "Per KM",
  per_day: "Per Day",
};

export default function ExpensesPage() {
  const { authenticated } = useRequireAuth();
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadExpenses = () => {
    api<ApiListResponse<Expense>>("/expenses")
      .then((res) => setExpenses(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load expenses"),
      );
  };

  useEffect(() => {
    if (!authenticated) return;
    loadExpenses();
  }, [authenticated]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const rateStr = form.get("rate") as string;
    const dto: CreateExpenseDto = {
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
      type: form.get("type") as ExpenseType,
      rateCents: rateStr ? Math.round(parseFloat(rateStr) * 100) : undefined,
    };

    try {
      if (editingId) {
        await api<ApiResponse<Expense>>(`/expenses/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(dto),
        });
        addToast("Expense updated");
      } else {
        await api<ApiResponse<Expense>>("/expenses", {
          method: "POST",
          body: JSON.stringify(dto),
        });
        addToast("Expense created");
      }
      setShowForm(false);
      setEditingId(null);
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

  async function handleArchive(id: string) {
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      addToast("Expense archived");
      loadExpenses();
    } catch {
      addToast("Failed to archive expense", "error");
    }
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setShowForm(true);
  }

  const editingExpense = editingId
    ? expenses.find((e) => e.id === editingId)
    : null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <PageHeader title="Expenses">
          <div className="flex items-center gap-3">
            <Link
              href="/expenses/archived"
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              View Archived
            </Link>
            <Button
              onClick={() => {
                setEditingId(null);
                setShowForm((v) => !v);
              }}
            >
              {showForm && !editingId ? "Cancel" : "+ New Expense"}
            </Button>
          </div>
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4 p-1">
              <FormField label="Name" htmlFor="name" required>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={editingExpense?.name ?? ""}
                  key={editingId}
                />
              </FormField>

              <FormField label="Description" htmlFor="description">
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={editingExpense?.description ?? ""}
                  key={editingId}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Type" htmlFor="type" required>
                  <Select
                    id="type"
                    name="type"
                    required
                    defaultValue={editingExpense?.type ?? "dollar"}
                    key={editingId}
                  >
                    <option value="dollar">Dollar</option>
                    <option value="per_km">Per KM</option>
                    <option value="per_day">Per Day</option>
                  </Select>
                </FormField>

                <FormField label="Rate ($)" htmlFor="rate">
                  <Input
                    id="rate"
                    name="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={
                      editingExpense
                        ? (editingExpense.rateCents / 100).toFixed(2)
                        : ""
                    }
                    placeholder="0.00"
                    key={editingId}
                  />
                </FormField>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Update Expense"
                      : "Create Expense"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {expenses.length === 0 && !error && !showForm ? (
          <EmptyState message="No expenses defined yet." />
        ) : (
          <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="font-medium">{expense.name}</p>
                  {expense.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {expense.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {expense.type !== "dollar" && (
                      <p className="font-medium">
                        ${(expense.rateCents / 100).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {TYPE_LABELS[expense.type]}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(expense)}
                    className="text-sm text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleArchive(expense.id)}
                    className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
