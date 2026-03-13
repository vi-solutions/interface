"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiListResponse, ProjectWithClient } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";

export default function ProjectsPage() {
  const { authenticated } = useRequireAuth();
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiListResponse<ProjectWithClient>>("/projects")
      .then((res) => setProjects(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load projects"),
      );
  }, [authenticated]);

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Link
            href="/projects/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            New Project
          </Link>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {projects.length === 0 && !error ? (
          <p className="text-gray-500 dark:text-gray-400">No projects yet.</p>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">{project.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.client.name}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                    {project.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
