"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiListResponse, Expense, ExpenseType } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { PageHeader, EmptyState, ErrorAlert } from "@/components/ui";

const TYPE_LABELS: Record<ExpenseType, string> = {
  dollar: "Dollar",
  per_km: "Per KM",
  per_day: "Per Day",
};

export default function ArchivedExpensesPage() {
  const { authenticated } = useRequireAuth();
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = () => {
    api<ApiListResponse<Expense>>("/expenses/archived")
      .then((res) => setExpenses(res.data))
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load archived expenses",
        ),
      );
  };

  useEffect(() => {
    if (!authenticated) return;
    loadExpenses();
  }, [authenticated]);

  if (!authenticated) return null;

  async function handleUnarchive(id: string) {
    try {
      await api(`/expenses/${id}/unarchive`, { method: "POST" });
      addToast("Expense restored");
      loadExpenses();
    } catch {
      addToast("Failed to restore expense", "error");
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <PageHeader title="Archived Expenses">
          <Link
            href="/expenses"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            &larr; Back to Expenses
          </Link>
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {expenses.length === 0 && !error ? (
          <EmptyState message="No archived expenses." />
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
                    onClick={() => handleUnarchive(expense.id)}
                    className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    Restore
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
