"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiListResponse,
  ApiResponse,
  User,
  UserRole,
  CreateUserDto,
  UpdateUserDto,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button } from "@/components/ui";

function fmtRate(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function UsersPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(() => {
    api<ApiListResponse<User>>("/users")
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    if (currentUser && !currentUser.isAdmin) {
      router.push("/");
      return;
    }
    loadUsers();
  }, [authenticated, currentUser, router, loadUsers]);

  if (!authenticated || !currentUser?.isAdmin) return null;

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete team member "${name}"? This cannot be undone.`))
      return;
    try {
      await api(`/users/${id}`, { method: "DELETE" });
      addToast("Team member deleted");
      loadUsers();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to delete team member",
        "error",
      );
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const dto: CreateUserDto = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      password: form.get("password") as string,
      role: (form.get("role") as UserRole) || "contractor",
      rateCents: Math.round(
        parseFloat((form.get("rateCents") as string) || "0") * 100,
      ),
      dailyRateCents: Math.round(
        parseFloat((form.get("dailyRateCents") as string) || "0") * 100,
      ),
      hourlyCostCents: Math.round(
        parseFloat((form.get("hourlyCostCents") as string) || "0") * 100,
      ),
    };
    try {
      await api<ApiResponse<User>>("/users", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Team member created");
      setShowNew(false);
      loadUsers();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to create team member",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        <PageHeader
          title="Teams"
          subtitle="Manage team members and their access."
        >
          <Button onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "+ New Team Member"}
          </Button>
        </PageHeader>

        {/* New Team Member Form */}
        {showNew && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
          >
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              New Team Member
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  name="role"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="contractor">Contractor</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Charge-out Rate ($/hr)
                </label>
                <input
                  name="rateCents"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Daily Rate ($/day)
                </label>
                <input
                  name="dailyRateCents"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hourly Wage ($/hr)
                </label>
                <input
                  name="hourlyCostCents"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Team Member"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Teams Table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Role
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Rate ($/hr)
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Rate ($/day)
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Wage ($/hr)
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          u.role === "admin"
                            ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
                            : u.role === "employee"
                              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      ${fmtRate(u.rateCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      ${fmtRate(u.dailyRateCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      ${fmtRate(u.hourlyCostCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/teams/${u.id}`)}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Edit
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:border-red-400 dark:hover:border-red-600 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              No team members yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
