"use client";

import { useEffect, useState } from "react";
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
        <PageHeader title="Projects">
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
