"use client";

import { useEffect, useState, useCallback } from "react";
import type { ApiListResponse, ApiResponse, User } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminUsersPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);

  const loadUsers = useCallback(() => {
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
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

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    try {
      await api<ApiResponse<User>>(`/users/${userId}/admin`, {
        method: "PUT",
        body: JSON.stringify({ isAdmin }),
      });
      addToast(isAdmin ? "User promoted to admin" : "Admin access removed");
      loadUsers();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update user",
        "error",
      );
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <button
            onClick={() => router.push("/admin/users/new")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            + New User
          </button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
          Grant or revoke admin privileges for team members.
        </p>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Email
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Admin
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        {u.name}
                      </Link>
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAdmin(u.id, !u.isAdmin)}
                        disabled={isSelf}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                          u.isAdmin
                            ? "bg-emerald-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        } ${isSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        aria-label={`${u.isAdmin ? "Revoke" : "Grant"} admin for ${u.name}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                            u.isAdmin ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
