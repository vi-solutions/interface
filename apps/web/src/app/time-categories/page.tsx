"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ApiListResponse,
  ApiResponse,
  TimeCategory,
  CreateTimeCategoryDto,
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
  Textarea,
  EmptyState,
  ErrorAlert,
} from "@/components/ui";

export default function TimeCategoriesPage() {
  const { authenticated } = useRequireAuth();
  const { addToast } = useToast();
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadCategories = () => {
    api<ApiListResponse<TimeCategory>>("/time-categories")
      .then((res) => setCategories(res.data))
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load time categories",
        ),
      );
  };

  useEffect(() => {
    if (!authenticated) return;
    loadCategories();
  }, [authenticated]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateTimeCategoryDto = {
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
    };

    try {
      if (editingId) {
        await api<ApiResponse<TimeCategory>>(`/time-categories/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(dto),
        });
        addToast("Time category updated");
      } else {
        await api<ApiResponse<TimeCategory>>("/time-categories", {
          method: "POST",
          body: JSON.stringify(dto),
        });
        addToast("Time category created");
      }
      setShowForm(false);
      setEditingId(null);
      loadCategories();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to save time category",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    try {
      await api(`/time-categories/${id}`, { method: "DELETE" });
      addToast("Time category archived");
      loadCategories();
    } catch {
      addToast("Failed to archive time category", "error");
    }
  }

  function startEdit(category: TimeCategory) {
    setEditingId(category.id);
    setShowForm(true);
  }

  const editingCategory = editingId
    ? categories.find((c) => c.id === editingId)
    : null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <PageHeader title="Time Categories">
          <div className="flex items-center gap-3">
            <Link
              href="/time-categories/archived"
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
              {showForm && !editingId ? "Cancel" : "+ New Category"}
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
                  defaultValue={editingCategory?.name ?? ""}
                  key={editingId}
                />
              </FormField>

              <FormField label="Description" htmlFor="description">
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={editingCategory?.description ?? ""}
                  key={editingId}
                />
              </FormField>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Update Category"
                      : "Create Category"}
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

        {categories.length === 0 && !error && !showForm ? (
          <EmptyState message="No time categories defined yet." />
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
                    onClick={() => startEdit(category)}
                    className="text-sm text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleArchive(category.id)}
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
