"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiListResponse, TimeCategory } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { PageHeader, EmptyState, ErrorAlert } from "@/components/ui";

export default function ArchivedTimeCategoriesPage() {
  const { authenticated } = useRequireAuth();
  const { addToast } = useToast();
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = () => {
    api<ApiListResponse<TimeCategory>>("/time-categories/archived")
      .then((res) => setCategories(res.data))
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load archived time categories",
        ),
      );
  };

  useEffect(() => {
    if (!authenticated) return;
    loadCategories();
  }, [authenticated]);

  if (!authenticated) return null;

  async function handleUnarchive(id: string) {
    try {
      await api(`/time-categories/${id}/unarchive`, { method: "POST" });
      addToast("Time category restored");
      loadCategories();
    } catch {
      addToast("Failed to restore time category", "error");
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <PageHeader title="Archived Time Categories">
          <Link
            href="/time-categories"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            &larr; Back to Time Categories
          </Link>
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {categories.length === 0 && !error ? (
          <EmptyState message="No archived time categories." />
        ) : (
          <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="font-medium">{category.name}</p>
                  {category.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {category.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleUnarchive(category.id)}
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
