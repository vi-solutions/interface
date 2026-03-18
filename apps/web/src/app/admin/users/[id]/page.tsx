"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApiResponse, User, UpdateUserDto } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default function EditUserPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    if (currentUser && !currentUser.isAdmin) {
      router.push("/");
      return;
    }
    api<ApiResponse<User>>(`/users/${id}`)
      .then((res) => setUser(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load user"),
      );
  }, [authenticated, id, currentUser, router]);

  if (!authenticated || !currentUser?.isAdmin) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: UpdateUserDto = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      isAdmin: form.get("isAdmin") === "on",
    };

    try {
      const res = await api<ApiResponse<User>>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      setUser(res.data);
      addToast("User updated successfully");
      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href="/admin/users"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ← Back to Users
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-8">Edit User</h1>

        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!user && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {user && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={user.name}
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
                defaultValue={user.email}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="isAdmin"
                name="isAdmin"
                type="checkbox"
                defaultChecked={user.isAdmin}
                disabled={user.id === currentUser?.id}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isAdmin" className="text-sm font-medium">
                Admin privileges
              </label>
              {user.id === currentUser?.id && (
                <span className="text-xs text-gray-400">
                  (cannot change your own admin status)
                </span>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
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
        )}
      </div>
    </AppShell>
  );
}
