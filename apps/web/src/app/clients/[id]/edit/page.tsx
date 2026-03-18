"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApiResponse, Client, UpdateClientDto } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default function EditClientPage() {
  const { authenticated } = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<Client>>(`/clients/${id}`)
      .then((res) => setClient(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load client"),
      );
  }, [authenticated, id]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: UpdateClientDto = {
      name: form.get("name") as string,
      contactName: (form.get("contactName") as string) || undefined,
      contactEmail: (form.get("contactEmail") as string) || undefined,
      contactPhone: (form.get("contactPhone") as string) || undefined,
      address: (form.get("address") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    try {
      await api<ApiResponse<Client>>(`/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      addToast("Client updated successfully");
      router.push(`/clients/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href={`/clients/${id}`}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ← Back to Client
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-8">Edit Client</h1>

        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!client && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {client && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={client.name}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                defaultValue={client.contactName ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                defaultValue={client.contactEmail ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                defaultValue={client.contactPhone ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium mb-1"
              >
                Address
              </label>
              <input
                id="address"
                name="address"
                defaultValue={client.address ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                defaultValue={client.notes ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
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
                onClick={() => router.push(`/clients/${id}`)}
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
