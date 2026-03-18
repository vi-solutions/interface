"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiResponse, User, CreateUserDto } from "@interface/shared";
import { AppShell } from "@/components/app-shell";
import { PageHeader, FormField, Input, Button, ErrorAlert } from "@/components/ui";
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
        <PageHeader title="New User" />

        {error && <ErrorAlert message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" htmlFor="name" required>
            <Input id="name" name="name" required />
          </FormField>

          <FormField label="Email" htmlFor="email" required>
            <Input id="email" name="email" type="email" required />
          </FormField>

          <FormField label="Password" htmlFor="password" required>
            <Input id="password" name="password" type="password" required minLength={8} />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Minimum 8 characters
            </p>
          </FormField>

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
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/admin/users")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
