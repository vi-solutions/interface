"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectStatus, ProjectWithClient } from "@interface/shared";
import { formatDateString } from "@/lib/dates";
import { Badge, EmptyState, Select } from "@/components/ui";

type SortBy = "name" | "code" | "client" | "projectManager" | "status" | "createdAt";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | ProjectStatus;

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  active: "Active",
  "on-hold": "On hold",
  completed: "Completed",
  archived: "Archived",
};

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "active",
  "on-hold",
  "draft",
  "completed",
  "archived",
];

interface ProjectTableProps {
  projects: ProjectWithClient[];
  emptyMessage?: string;
  framed?: boolean;
  maxRows?: number;
  showStatusFilter?: boolean;
}

export function ProjectTable({
  projects,
  emptyMessage = "No projects yet.",
  framed = true,
  maxRows,
  showStatusFilter = false,
}: ProjectTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();

  const filteredProjects = projects
    .filter(
      (project) => project.status === statusFilter || statusFilter === "all",
    )
    .filter((project) => {
      if (!query) return true;
      return (
        project.name.toLowerCase().includes(query) ||
        project.client.name.toLowerCase().includes(query) ||
        (project.projectManager?.name ?? "").toLowerCase().includes(query)
      );
    });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let result = 0;

    if (sortBy === "name") {
      result = a.name.localeCompare(b.name);
    } else if (sortBy === "code") {
      result = (a.code ?? "").localeCompare(b.code ?? "");
    } else if (sortBy === "client") {
      result =
        a.client.name.localeCompare(b.client.name) ||
        a.name.localeCompare(b.name);
    } else if (sortBy === "projectManager") {
      result =
        (a.projectManager?.name ?? "").localeCompare(
          b.projectManager?.name ?? "",
        ) || a.name.localeCompare(b.name);
    } else if (sortBy === "createdAt") {
      result =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      result =
        PROJECT_STATUS_ORDER.indexOf(a.status) -
          PROJECT_STATUS_ORDER.indexOf(b.status) ||
        a.name.localeCompare(b.name);
    }

    return sortDirection === "asc" ? result : -result;
  });

  const visibleProjects =
    maxRows != null ? sortedProjects.slice(0, maxRows) : sortedProjects;

  function handleSort(nextSortBy: SortBy) {
    if (nextSortBy === sortBy) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDirection("asc");
  }

  if (projects.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end">
        <div className="flex-1 min-w-48 mb-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, clients, PMs…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        {showStatusFilter && (
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              {PROJECT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {visibleProjects.length === 0 ? (
        <EmptyState
          message={
            query
              ? "No projects match your search."
              : "No projects match this status."
          }
        />
      ) : (
        <div
          className={
            framed
              ? "overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              : "overflow-hidden"
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <SortableHeader
                  label="Project"
                  sortKey="name"
                  activeSortKey={sortBy}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Code"
                  sortKey="code"
                  activeSortKey={sortBy}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Client"
                  sortKey="client"
                  activeSortKey={sortBy}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="PM"
                  sortKey="projectManager"
                  activeSortKey={sortBy}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  activeSortKey={sortBy}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Created"
                  sortKey="createdAt"
                  activeSortKey={sortBy}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                    {project.code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {project.client.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {project.projectManager?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {formatDateString(project.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortBy;
  activeSortKey: SortBy;
  direction: SortDirection;
  onSort: (sortKey: SortBy) => void;
}) {
  const active = sortKey === activeSortKey;

  return (
    <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center justify-between gap-3 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        {label}
        {active && (
          <span
            className="text-[10px] leading-none text-gray-900 dark:text-gray-100"
            aria-hidden="true"
          >
            {direction === "asc" ? "▲" : "▼"}
          </span>
        )}
      </button>
    </th>
  );
}
