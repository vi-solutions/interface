"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api } from "@/lib/api";
import type { ApiResponse, Client, CreateClientDto } from "@interface/shared";
import { AppShell } from "@/components/app-shell";
import { useToast } from "@/lib/toast-context";

export default function NewClientPage() {
  const { authenticated } = useRequireAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateClientDto = {
      name: form.get("name") as string,
      contactName: (form.get("contactName") as string) || undefined,
      contactEmail: (form.get("contactEmail") as string) || undefined,
      contactPhone: (form.get("contactPhone") as string) || undefined,
      address: (form.get("address") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    try {
      await api<ApiResponse<Client>>("/clients", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Client created successfully");
      router.push("/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-8">New Client</h1>

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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="contactName"
              className="block text-sm font-medium mb-1"
            >
              Contact Name
            </label>
            <input
              id="contactName"
              name="contactName"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="contactEmail"
              className="block text-sm font-medium mb-1"
            >
              Contact Email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="contactPhone"
              className="block text-sm font-medium mb-1"
            >
              Contact Phone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium mb-1">
              Address
            </label>
            <input
              id="address"
              name="address"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Client"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/clients")}
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
