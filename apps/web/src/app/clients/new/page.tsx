"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api } from "@/lib/api";
import type { ApiResponse, Client, CreateClientDto } from "@interface/shared";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  FormField,
  Input,
  Textarea,
  Button,
  ErrorAlert,
} from "@/components/ui";
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
        <PageHeader title="New Client" />

        {error && <ErrorAlert message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" htmlFor="name" required>
            <Input id="name" name="name" required />
          </FormField>

          <FormField label="Contact Name" htmlFor="contactName">
            <Input id="contactName" name="contactName" />
          </FormField>

          <FormField label="Contact Email" htmlFor="contactEmail">
            <Input id="contactEmail" name="contactEmail" type="email" />
          </FormField>

          <FormField label="Contact Phone" htmlFor="contactPhone">
            <Input id="contactPhone" name="contactPhone" type="tel" />
          </FormField>

          <FormField label="Address" htmlFor="address">
            <Input id="address" name="address" />
          </FormField>

          <FormField label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={3} />
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create Client"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/clients")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
