"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui";
import { ProjectTable } from "@/components/project-table";
import { api } from "@/lib/api";
import type { ApiListResponse, ProjectWithClient, ProjectFinancialSummary, Task } from "@interface/shared";

interface DashboardData {
  projects: ProjectWithClient[];
}

export default function Home() {
  const { authenticated } = useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [financialSummaries, setFinancialSummaries] = useState<ProjectFinancialSummary[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    if (user && user.role === "contractor") {
      router.push("/projects");
      return;
    }
    api<ApiListResponse<ProjectWithClient>>("/projects").then((projects) => {
      setData({ projects: projects.data });
    });
    api<ApiListResponse<Task>>("/tasks").then((res) => setTasks(res.data));
    api<ApiListResponse<ProjectFinancialSummary>>("/projects/financial-summary").then(
      (res) => setFinancialSummaries(res.data),
    );
  }, [authenticated]);

  if (!authenticated) return null;

  const activeProjects =
    data?.projects.filter((p) => p.status === "active") ?? [];

  const projectById = Object.fromEntries(
    (data?.projects ?? []).map((p) => [p.id, p]),
  );

  // Sum task logged hours per project (tasks cover tagged time entries)
  const projectLoggedHours: Record<string, number> = {};
  for (const t of tasks) {
    projectLoggedHours[t.projectId] =
      (projectLoggedHours[t.projectId] ?? 0) + Number(t.loggedHours);
  }

  // Tasks at ≥ 80% of their hour budget (includes over-budget)
  const nearingCapTasks = tasks
    .filter((t) => t.budgetHours != null && Number(t.budgetHours) > 0)
    .map((t) => ({
      ...t,
      pct: Number(t.loggedHours) / Number(t.budgetHours),
    }))
    .filter((t) => t.pct >= 0.8)
    .sort((a, b) => b.pct - a.pct);

  // Active projects with an hours budget that's been exceeded
  const overBudgetProjects = activeProjects
    .filter((p) => p.budgetHours != null && Number(p.budgetHours) > 0)
    .map((p) => ({
      ...p,
      logged: projectLoggedHours[p.id] ?? 0,
      budget: Number(p.budgetHours),
    }))
    .filter((p) => p.logged > p.budget)
    .sort((a, b) => b.logged / b.budget - a.logged / a.budget);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {greeting}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
            Here&apos;s what&apos;s happening with your projects.
          </p>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Link
              href="/projects"
              className="text-xs text-[#BA7A61] hover:underline mr-2"
            >
              View all
            </Link>
          </div>
          <Card padding={false} className="overflow-hidden">
            <div className="p-2">
              <ProjectTable
                projects={activeProjects}
                emptyMessage="No active projects yet."
                framed={false}
                maxRows={10}
              />
            </div>
          </Card>
        </div>

        {/* Projects Over Hours Budget */}
        {overBudgetProjects.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Projects Over Hours Budget</h2>
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-800 overflow-hidden">
              {overBudgetProjects.map((p, i) => {
                const pct = Math.min(p.logged / p.budget, 2);
                return (
                  <div
                    key={p.id}
                    className={`px-4 py-3 flex items-center gap-4 ${i < overBudgetProjects.length - 1 ? "border-b border-gray-100 dark:border-gray-700/50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {p.client.name}
                      </p>
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${Math.min(pct * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-sm tabular-nums text-red-600 dark:text-red-400 font-medium shrink-0">
                      {p.logged.toFixed(1)}h / {p.budget.toFixed(1)}h
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Projects Over Dollar Budget */}
        {user?.isAdmin && (() => {
          const overFinancial = financialSummaries
            .filter(
              (p) =>
                p.budgetCents != null &&
                Number(p.budgetCents) > 0 &&
                Number(p.budgetUsedCents) > Number(p.budgetCents),
            )
            .sort(
              (a, b) =>
                Number(b.budgetUsedCents) / Number(b.budgetCents) -
                Number(a.budgetUsedCents) / Number(a.budgetCents),
            );
          if (overFinancial.length === 0) return null;
          return (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Projects Over Dollar Budget</h2>
              <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-800 overflow-hidden">
                {overFinancial.map((p, i) => {
                  const budgetCents = Number(p.budgetCents);
                  const usedCents = Number(p.budgetUsedCents);
                  const ratio = budgetCents > 0 ? usedCents / budgetCents : 2;
                  const overBy = usedCents - budgetCents;
                  return (
                    <div
                      key={p.id}
                      className={`px-4 py-3 flex items-center gap-4 ${i < overFinancial.length - 1 ? "border-b border-gray-100 dark:border-gray-700/50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {p.client.name}
                        </p>
                      </div>
                      <div className="w-32 shrink-0">
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-sm tabular-nums text-red-600 dark:text-red-400 font-medium shrink-0">
                        ${(overBy / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} over
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Tasks Nearing Budget */}
        {nearingCapTasks.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Tasks Nearing Budget</h2>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              {nearingCapTasks.map((t, i) => {
                const over = t.pct > 1;
                const project = projectById[t.projectId];
                return (
                  <div
                    key={t.id}
                    className={`px-4 py-3 flex items-center gap-4 ${i < nearingCapTasks.length - 1 ? "border-b border-gray-100 dark:border-gray-700/50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/projects/${t.projectId}`}
                        className="text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block"
                      >
                        {t.name}
                      </Link>
                      {project && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {project.name}
                        </p>
                      )}
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${over ? "bg-red-500" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(t.pct * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className={`text-sm tabular-nums font-medium shrink-0 ${over ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {Number(t.loggedHours).toFixed(1)}h / {Number(t.budgetHours).toFixed(1)}h
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {user?.isAdmin && (
            <QuickAction href="/projects/new" label="New Project" icon="+" />
          )}
          {user?.isAdmin && (
            <QuickAction href="/clients/new" label="New Client" icon="+" />
          )}
          <QuickAction href="/time" label="Log Time" icon="⏱" />
          <QuickAction href="/documents" label="Link Document" icon="📎" />
        </div>
      </div>
    </AppShell>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-5 text-center hover:border-[#696D3D] hover:bg-[#F0F2E8] dark:hover:bg-[#696D3D]/10 dark:hover:border-[#696D3D] transition-colors group"
    >
      <span className="text-xl group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
      </span>
    </Link>
  );
}
