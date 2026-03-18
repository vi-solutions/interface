"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApiResponse, Client, UpdateClientDto } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  FormField,
  Input,
  Textarea,
  Button,
  ErrorAlert,
} from "@/components/ui";
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

        <PageHeader title="Edit Client" />

        {error && <ErrorAlert message={error} />}

        {!client && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {client && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                required
                defaultValue={client.name}
              />
            </FormField>

            <FormField label="Contact Name" htmlFor="contactName">
              <Input
                id="contactName"
                name="contactName"
                defaultValue={client.contactName ?? ""}
              />
            </FormField>

            <FormField label="Contact Email" htmlFor="contactEmail">
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={client.contactEmail ?? ""}
              />
            </FormField>

            <FormField label="Contact Phone" htmlFor="contactPhone">
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                defaultValue={client.contactPhone ?? ""}
              />
            </FormField>

            <FormField label="Address" htmlFor="address">
              <Input
                id="address"
                name="address"
                defaultValue={client.address ?? ""}
              />
            </FormField>

            <FormField label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={client.notes ?? ""}
              />
            </FormField>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/clients/${id}`)}
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
