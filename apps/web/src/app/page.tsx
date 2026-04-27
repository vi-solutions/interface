"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader } from "@/components/ui";
import { api } from "@/lib/api";
import type {
  ApiListResponse,
  ProjectWithClient,
  Client,
  TimeEntryWithDetails,
  DocumentWithDetails,
  Task,
} from "@interface/shared";

interface DashboardData {
  projects: ProjectWithClient[];
  clients: Client[];
  timeEntries: TimeEntryWithDetails[];
  documents: DocumentWithDetails[];
  tasks: Task[];
}

export default function Home() {
  const { authenticated } = useRequireAuth();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    Promise.all([
      api<ApiListResponse<ProjectWithClient>>("/projects"),
      api<ApiListResponse<Client>>("/clients"),
      api<ApiListResponse<TimeEntryWithDetails>>("/time-entries"),
      api<ApiListResponse<DocumentWithDetails>>("/documents"),
      api<ApiListResponse<Task>>("/tasks"),
    ]).then(([projects, clients, time, docs, tasks]) => {
      setData({
        projects: projects.data,
        clients: clients.data,
        timeEntries: time.data,
        documents: docs.data,
        tasks: tasks.data,
      });
    });
  }, [authenticated]);

  if (!authenticated) return null;

  const activeProjects =
    data?.projects.filter((p) => p.status === "active") ?? [];
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));

  // Tasks with a time budget, on active projects only
  const budgetedTasks = (data?.tasks ?? [])
    .filter((t) => t.budgetHours != null && activeProjectIds.has(t.projectId))
    .map((t) => {
      const logged = (data?.timeEntries ?? [])
        .filter((e) => e.taskId === t.id)
        .reduce((sum, e) => sum + Number(e.hours), 0);
      return { ...t, loggedHours: logged };
    })
    .sort((a, b) => {
      const aUsed = a.budgetHours! > 0 ? a.loggedHours / a.budgetHours! : 0;
      const bUsed = b.budgetHours! > 0 ? b.loggedHours / b.budgetHours! : 0;
      return bUsed - aUsed;
    });
  const totalHours =
    data?.timeEntries.reduce((sum, e) => sum + Number(e.hours), 0) ?? 0;
  const billableHours =
    data?.timeEntries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + Number(e.hours), 0) ?? 0;

  // This week's hours
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekHours =
    data?.timeEntries
      .filter((e) => new Date(e.date) >= weekStart)
      .reduce((sum, e) => sum + Number(e.hours), 0) ?? 0;

  const recentEntries = data?.timeEntries.slice(0, 5) ?? [];
  const recentDocs = data?.documents.slice(0, 5) ?? [];

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening across your projects.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Projects"
            value={data ? String(activeProjects.length) : "—"}
            sub={`${data?.projects.length ?? 0} total`}
            icon={<FolderIcon />}
            color="emerald"
          />
          <StatCard
            label="Clients"
            value={data ? String(data.clients.length) : "—"}
            sub="total accounts"
            icon={<UsersIcon />}
            color="blue"
          />
          <StatCard
            label="Hours This Week"
            value={data ? weekHours.toFixed(1) : "—"}
            sub={`${totalHours.toFixed(1)} all time`}
            icon={<ClockIcon />}
            color="amber"
          />
          <StatCard
            label="Billable Hours"
            value={data ? billableHours.toFixed(1) : "—"}
            sub={
              totalHours > 0
                ? `${((billableHours / totalHours) * 100).toFixed(0)}% billable rate`
                : "no entries yet"
            }
            icon={<CurrencyIcon />}
            color="violet"
          />
        </div>

        {/* Task Time Budgets */}
        {budgetedTasks.length > 0 && (
          <Card className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Task Budgets
            </h2>
            <div className="space-y-6">
              {Object.entries(
                budgetedTasks.reduce<Record<string, typeof budgetedTasks>>(
                  (acc, task) => {
                    (acc[task.projectId] ??= []).push(task);
                    return acc;
                  },
                  {},
                ),
              ).map(([projectId, tasks]) => {
                const project = data?.projects.find((p) => p.id === projectId);
                return (
                  <div key={projectId}>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      {project?.name ?? "Unknown Project"}
                    </p>
                    <div className="space-y-3">
                      {tasks.map((task) => {
                        const pct = task.budgetHours!
                          ? Math.min(
                              (task.loggedHours / task.budgetHours!) * 100,
                              100,
                            )
                          : 0;
                        const over = task.loggedHours > task.budgetHours!;
                        return (
                          <div key={task.id}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium truncate">
                                {task.name}
                              </span>
                              <span
                                className={`tabular-nums ml-4 shrink-0 text-xs ${
                                  over
                                    ? "text-red-500 dark:text-red-400 font-medium"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {task.loggedHours.toFixed(1)}h /{" "}
                                {task.budgetHours}h
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  over
                                    ? "bg-red-500"
                                    : pct >= 80
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-8 mb-8">
          {/* Active Projects */}
          <Card padding={false} className="overflow-hidden">
            <CardHeader
              title="Active Projects"
              action={
                <Link
                  href="/projects"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  View all
                </Link>
              }
            />
            {activeProjects.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">
                No active projects yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {activeProjects.slice(0, 6).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${phaseColor(project.phase)}`}
                    >
                      {project.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {project.client.name}
                        {project.phase && (
                          <span className="ml-2 capitalize">
                            · {project.phase}
                          </span>
                        )}
                      </p>
                    </div>
                    {project.endDate && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                        Due {new Date(project.endDate).toLocaleDateString()}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/projects/new" label="New Project" icon="+" />
          <QuickAction href="/clients/new" label="New Client" icon="+" />
          <QuickAction href="/time" label="Log Time" icon="⏱" />
          <QuickAction href="/documents" label="Link Document" icon="📎" />
        </div>
      </div>
    </AppShell>
  );
}

/* ---------- Sub-components ---------- */

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "amber" | "violet";
}) {
  const colors = {
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
  };

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>
    </Card>
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
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-5 text-center hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 dark:hover:border-emerald-500 transition-colors group"
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

function phaseColor(phase: string | null): string {
  switch (phase) {
    case "assessment":
      return "bg-blue-500";
    case "analysis":
      return "bg-indigo-500";
    case "restoration":
      return "bg-emerald-500";
    case "permitting":
      return "bg-amber-500";
    case "reporting":
      return "bg-violet-500";
    default:
      return "bg-gray-400";
  }
}

/* ---------- Icons ---------- */

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95a.75.75 0 0 0 1.196-.91C12.637 5.55 11.5 5 10.5 5s-2.137.55-2.898 1.54A4.25 4.25 0 0 0 6.75 9.25c0 1.152.26 2.108.852 2.71.761.99 1.898 1.54 2.898 1.54s2.137-.55 2.898-1.54a.75.75 0 0 0-1.196-.91c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95A2.75 2.75 0 0 1 8.25 9.25c0-.752.187-1.42.548-1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
    </svg>
  );
}
