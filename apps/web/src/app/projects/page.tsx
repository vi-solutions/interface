"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiListResponse, ProjectWithClient } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  LinkButton,
  Card,
  Badge,
  ErrorAlert,
  EmptyState,
} from "@/components/ui";

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
        <PageHeader title="Projects">
          <LinkButton href="/projects/new">New Project</LinkButton>
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {projects.length === 0 && !error ? (
          <EmptyState message="No projects yet." />
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block hover:shadow-md transition-shadow"
              >
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">{project.name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {project.client.name}
                        {project.projectManager && (
                          <span> · PM: {project.projectManager.name}</span>
                        )}
                      </p>
                    </div>
                    <Badge>{project.status}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
