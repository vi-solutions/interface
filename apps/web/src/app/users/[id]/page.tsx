"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse, User, UpdateUserDto } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  FormField,
  Input,
  Button,
  ErrorAlert,
} from "@/components/ui";

export default function EditUserPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
    if (newPassword && newPassword.length < 6) {
      setPasswordError("Minimum 6 characters");
      return;
    }
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const rateStr = form.get("rateCents") as string;
    const dailyStr = form.get("dailyRateCents") as string;
    const costStr = form.get("hourlyCostCents") as string;
    const dto: UpdateUserDto = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      isAdmin: form.get("isAdmin") === "on",
      rateCents: rateStr ? Math.round(parseFloat(rateStr) * 100) : 0,
      dailyRateCents: dailyStr ? Math.round(parseFloat(dailyStr) * 100) : 0,
      hourlyCostCents: costStr ? Math.round(parseFloat(costStr) * 100) : 0,
    };

    try {
      await api<ApiResponse<User>>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      if (newPassword) {
        await api(`/users/${id}/password`, {
          method: "PUT",
          body: JSON.stringify({ newPassword }),
        });
      }
      addToast("User updated");
      router.push("/users");
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
            href="/users"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ← Back to Users
          </Link>
        </div>

        <PageHeader title="Edit User" />

        {error && <ErrorAlert message={error} />}

        {!user && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {user && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Name" htmlFor="name" required>
              <Input id="name" name="name" required defaultValue={user.name} />
            </FormField>

            <FormField label="Email" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={user.email}
              />
            </FormField>

            <FormField label="Charge-out Rate ($/hr)" htmlFor="rateCents">
              <Input
                id="rateCents"
                name="rateCents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(Number(user.rateCents) / 100).toFixed(2)}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Daily Rate ($/day)" htmlFor="dailyRateCents">
              <Input
                id="dailyRateCents"
                name="dailyRateCents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(Number(user.dailyRateCents) / 100).toFixed(2)}
                placeholder="0.00"
              />
            </FormField>

            <FormField
              label="Hourly Wage / Cost ($/hr)"
              htmlFor="hourlyCostCents"
            >
              <Input
                id="hourlyCostCents"
                name="hourlyCostCents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(Number(user.hourlyCostCents) / 100).toFixed(2)}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="New Password" htmlFor="newPassword">
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                minLength={6}
                placeholder="Leave blank to keep current"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError("");
                }}
              />
              {passwordError && (
                <p className="text-xs text-red-500 mt-1">{passwordError}</p>
              )}
            </FormField>

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
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/users")}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
