"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiResponse, User, CreateUserDto } from "@interface/shared";
import { AppShell } from "@/components/app-shell";
import { useToast } from "@/lib/toast-context";

export default function NewUserPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!authenticated || !currentUser?.isAdmin) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateUserDto = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      password: form.get("password") as string,
      isAdmin: form.get("isAdmin") === "on",
    };

    try {
      await api<ApiResponse<User>>("/users", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("User created successfully");
      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-8">New User</h1>

        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Minimum 8 characters
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="isAdmin"
              name="isAdmin"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isAdmin" className="text-sm font-medium">
              Grant admin privileges
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create User"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/users")}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-2 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
