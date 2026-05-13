"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  ApiListResponse,
  ApiResponse,
  User,
  UserRole,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button, Card } from "@/components/ui";
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

  async function setRole(userId: string, role: UserRole) {
    try {
      await api<ApiResponse<User>>(`/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      addToast("Role updated");
      loadUsers();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update role",
        "error",
      );
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8">
        <PageHeader
          title="Manage Users"
          subtitle="Assign roles to team members."
        >
          <Button onClick={() => router.push("/admin/users/new")}>
            + New User
          </Button>
        </PageHeader>

        <Card padding={false} className="overflow-hidden">
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
                  Role
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
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) =>
                          setRole(u.id, e.target.value as UserRole)
                        }
                        className={`text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isSelf ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <option value="contractor">Contractor</option>
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
