"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiListResponse, ProjectWithClient } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { ProjectTable } from "@/components/project-table";
import { PageHeader, LinkButton, ErrorAlert } from "@/components/ui";

export default function ProjectsPage() {
  const { authenticated } = useRequireAuth();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const loadProjects = useCallback(() => {
    const query = includeArchived ? "?includeArchived=true" : "";
    api<ApiListResponse<ProjectWithClient>>(`/projects${query}`)
      .then((res) => setProjects(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load projects"),
      );
  }, [includeArchived]);

  useEffect(() => {
    if (!authenticated) return;
    loadProjects();
  }, [authenticated, loadProjects]);

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <PageHeader title="Projects">
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
            <LinkButton href="/projects/new">New Project</LinkButton>
          )}
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {!error && (
          <ProjectTable projects={projects} emptyMessage="No projects yet." />
        )}
      </div>
    </AppShell>
  );
}
