"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  ApiListResponse,
  ClientWithPrimaryContact,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
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
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientWithPrimaryContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const loadClients = useCallback(() => {
    const query = includeArchived ? "?includeArchived=true" : "";
    api<ApiListResponse<ClientWithPrimaryContact>>(`/clients${query}`)
      .then((res) => setClients(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load clients"),
      );
  }, [includeArchived]);

  useEffect(() => {
    if (!authenticated) return;
    loadClients();
  }, [authenticated, loadClients]);

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <PageHeader title="Clients">
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => setIncludeArchived((value) => !value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {includeArchived ? "Hide archived" : "Include archived"}
            </button>
          )}
          {user?.isAdmin && (
            <LinkButton href="/clients/new">New Client</LinkButton>
          )}
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
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{client.name}</h2>
                    {client.archivedAt && (
                      <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Archived
                      </span>
                    )}
                  </div>
                  {client.primaryContact && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {client.primaryContact.name}
                      {client.primaryContact.title && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {" "}
                          · {client.primaryContact.title}
                        </span>
                      )}
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
