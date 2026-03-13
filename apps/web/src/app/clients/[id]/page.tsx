"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  Client,
  ProjectWithClient,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";

export default function ClientDetailPage() {
  const { authenticated } = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<Client>>(`/clients/${id}`)
      .then((res) => setClient(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load client"),
      );
    api<ApiListResponse<ProjectWithClient>>("/projects")
      .then((res) => setProjects(res.data.filter((p) => p.clientId === id)))
      .catch(() => {});
  }, [authenticated, id]);

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!client && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {client && (
          <>
            <div className="mb-6">
              <Link
                href="/clients"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back to Clients
              </Link>
            </div>

            <h1 className="text-2xl font-bold mb-8">{client.name}</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 mb-8">
              {client.contactName && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Contact
                  </h3>
                  <p className="mt-1">{client.contactName}</p>
                </div>
              )}
              {client.contactEmail && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Email
                  </h3>
                  <p className="mt-1">{client.contactEmail}</p>
                </div>
              )}
              {client.contactPhone && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Phone
                  </h3>
                  <p className="mt-1">{client.contactPhone}</p>
                </div>
              )}
              {client.address && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Address
                  </h3>
                  <p className="mt-1">{client.address}</p>
                </div>
              )}
              {client.notes && (
                <div className="sm:col-span-2">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Notes
                  </h3>
                  <p className="mt-1">{client.notes}</p>
                </div>
              )}
            </div>

            {projects.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Projects</h2>
                <div className="grid gap-4">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{project.name}</h3>
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                          {project.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
