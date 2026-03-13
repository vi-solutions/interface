"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ApiResponse, ProjectWithClient } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";

export default function ProjectDetailPage() {
  const { authenticated } = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<ProjectWithClient>>(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load project"),
      );
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

        {!project && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && (
          <>
            <div className="mb-6">
              <Link
                href="/projects"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back to Projects
              </Link>
            </div>

            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  <Link
                    href={`/clients/${project.client.id}`}
                    className="hover:underline"
                  >
                    {project.client.name}
                  </Link>
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                {project.status}
              </span>
            </div>

            {project.description && (
              <div className="mb-8">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Description
                </h2>
                <p>{project.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              {project.phase && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Phase
                  </h3>
                  <p className="mt-1 capitalize">{project.phase}</p>
                </div>
              )}
              {project.startDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Start Date
                  </h3>
                  <p className="mt-1">
                    {new Date(project.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.endDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    End Date
                  </h3>
                  <p className="mt-1">
                    {new Date(project.endDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.budgetCents != null && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Budget
                  </h3>
                  <p className="mt-1">
                    $
                    {(project.budgetCents / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
