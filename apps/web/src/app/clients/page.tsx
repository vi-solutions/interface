"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiListResponse, Client } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  LinkButton,
  Card,
  ErrorAlert,
  EmptyState,
} from "@/components/ui";

export default function ClientsPage() {
  const { authenticated } = useRequireAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiListResponse<Client>>("/clients")
      .then((res) => setClients(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load clients"),
      );
  }, [authenticated]);

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <PageHeader title="Clients">
          <LinkButton href="/clients/new">New Client</LinkButton>
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {clients.length === 0 && !error ? (
          <EmptyState message="No clients yet." />
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block hover:shadow-md transition-shadow"
              >
                <Card>
                  <h2 className="font-semibold">{client.name}</h2>
                  {client.contactName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {client.contactName}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
