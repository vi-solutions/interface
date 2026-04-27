"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiListResponse,
  ApiResponse,
  User,
  CreateUserDto,
  UpdateUserDto,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button } from "@/components/ui";

interface EditFields {
  name: string;
  email: string;
  isAdmin: boolean;
  rateCents: string;
  hourlyCostCents: string;
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [newPassword, setNewPassword] = useState("");

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

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditFields({
      name: u.name,
      email: u.email,
      isAdmin: u.isAdmin,
      rateCents: fmtRate(u.rateCents),
      hourlyCostCents: fmtRate(u.hourlyCostCents),
    });
    setNewPassword("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFields(null);
    setNewPassword("");
  }

  async function saveEdit(id: string) {
    if (!editFields) return;
    setSaving(true);
    try {
      const dto: UpdateUserDto = {
        name: editFields.name,
        email: editFields.email,
        isAdmin: editFields.isAdmin,
        rateCents: Math.round(parseFloat(editFields.rateCents || "0") * 100),
        hourlyCostCents: Math.round(
          parseFloat(editFields.hourlyCostCents || "0") * 100,
        ),
      };
      await api<ApiResponse<User>>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      // Optionally update password
      if (newPassword.trim().length >= 6) {
        await api(`/users/${id}/password`, {
          method: "PUT",
          body: JSON.stringify({ newPassword: newPassword.trim() }),
        });
      }
      addToast("User updated");
      setEditingId(null);
      setEditFields(null);
      setNewPassword("");
      loadUsers();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update user",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api(`/users/${id}`, { method: "DELETE" });
      addToast("User deleted");
      loadUsers();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to delete user",
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
      isAdmin: form.get("isAdmin") === "on",
      rateCents: Math.round(
        parseFloat((form.get("rateCents") as string) || "0") * 100,
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
      addToast("User created");
      setShowNew(false);
      loadUsers();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to create user",
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
          title="Users"
          subtitle="Manage team members and their access."
        >
          <Button onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "+ New User"}
          </Button>
        </PageHeader>

        {/* New User Form */}
        {showNew && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
          >
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              New User
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
                  name="isAdmin"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Employee</option>
                  <option value="on">Admin</option>
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
                {saving ? "Creating…" : "Create User"}
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

        {/* Users Table */}
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
                  Wage ($/hr)
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                const isEditing = editingId === u.id;

                if (isEditing && editFields) {
                  return (
                    <tr
                      key={u.id}
                      className="bg-emerald-50 dark:bg-emerald-950/20"
                    >
                      <td className="px-4 py-2">
                        <input
                          value={editFields.name}
                          onChange={(e) =>
                            setEditFields(
                              (f) => f && { ...f, name: e.target.value },
                            )
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="email"
                          value={editFields.email}
                          onChange={(e) =>
                            setEditFields(
                              (f) => f && { ...f, email: e.target.value },
                            )
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editFields.isAdmin ? "admin" : "employee"}
                          disabled={isSelf}
                          onChange={(e) =>
                            setEditFields(
                              (f) =>
                                f && {
                                  ...f,
                                  isAdmin: e.target.value === "admin",
                                },
                            )
                          }
                          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                        >
                          <option value="employee">Employee</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFields.rateCents}
                          onChange={(e) =>
                            setEditFields(
                              (f) => f && { ...f, rateCents: e.target.value },
                            )
                          }
                          className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFields.hourlyCostCents}
                          onChange={(e) =>
                            setEditFields(
                              (f) =>
                                f && { ...f, hourlyCostCents: e.target.value },
                            )
                          }
                          className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex flex-col gap-1 items-end mr-2">
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="New password (optional)"
                              minLength={6}
                              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
                            />
                            {newPassword.length > 0 &&
                              newPassword.length < 6 && (
                                <span className="text-xs text-red-500">
                                  Min 6 chars
                                </span>
                              )}
                          </div>
                          <button
                            onClick={() => saveEdit(u.id)}
                            disabled={
                              saving ||
                              (newPassword.length > 0 && newPassword.length < 6)
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

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
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.isAdmin
                            ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {u.isAdmin ? "Admin" : "Employee"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      ${fmtRate(u.rateCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      ${fmtRate(u.hourlyCostCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(u)}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Edit
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
              No users yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
