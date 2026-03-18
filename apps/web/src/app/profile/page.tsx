"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { ApiResponse } from "@interface/shared";

const THEME_OPTIONS = [
  { value: "system", label: "System", description: "Match your OS setting" },
  { value: "light", label: "Light", description: "Always use light mode" },
  { value: "dark", label: "Dark", description: "Always use dark mode" },
] as const;

export default function ProfilePage() {
  const ready = useRequireAuth();
  const { user } = useAuth();
  const { preference, setPreference } = useTheme();
  const { addToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!ready || !user) return null;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await api<ApiResponse<{ message: string }>>("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      addToast("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold mb-8">Profile Settings</h1>

        {/* Account Info */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Name</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Role</span>
              <span className="font-medium">
                {user.isAdmin ? "Admin" : "Member"}
              </span>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <div className="grid gap-2">
            {THEME_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  preference === opt.value
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={preference === opt.value}
                  onChange={() => setPreference(opt.value)}
                  className="accent-emerald-600"
                />
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {opt.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Change Password */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Change Password"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
