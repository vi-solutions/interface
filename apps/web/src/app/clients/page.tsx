"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiListResponse, Client } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";

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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Clients</h1>
          <Link
            href="/clients/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            New Client
          </Link>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {clients.length === 0 && !error ? (
          <p className="text-gray-500 dark:text-gray-400">No clients yet.</p>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-md transition-shadow"
              >
                <h2 className="font-semibold">{client.name}</h2>
                {client.contactName && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {client.contactName}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
