"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  Client,
  ProjectWithClient,
  UpdateProjectDto,
  ProjectPhase,
  ProjectStatus,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

export default function EditProjectPage() {
  const { authenticated } = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<ProjectWithClient>>(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load project"),
      );
    api<ApiListResponse<Client>>("/clients")
      .then((res) => setClients(res.data))
      .catch(() => {});
  }, [authenticated, id]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const budgetStr = form.get("budget") as string;
    const dto: UpdateProjectDto = {
      clientId: form.get("clientId") as string,
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
      status: (form.get("status") as ProjectStatus) || undefined,
      phase: ((form.get("phase") as string) || undefined) as
        | ProjectPhase
        | undefined,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      budgetCents: budgetStr
        ? Math.round(parseFloat(budgetStr) * 100)
        : undefined,
    };

    try {
      await api<ApiResponse<ProjectWithClient>>(`/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      addToast("Project updated successfully");
      router.push(`/projects/${id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update project",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href={`/projects/${id}`}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ← Back to Project
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-8">Edit Project</h1>

        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!project && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="clientId"
                className="block text-sm font-medium mb-1"
              >
                Client <span className="text-red-500">*</span>
              </label>
              <select
                id="clientId"
                name="clientId"
                required
                defaultValue={project.clientId}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={project.name}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-1"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project.description ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium mb-1"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={project.status}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label htmlFor="phase" className="block text-sm font-medium mb-1">
                Phase
              </label>
              <select
                id="phase"
                name="phase"
                defaultValue={project.phase ?? ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">None</option>
                <option value="assessment">Assessment</option>
                <option value="analysis">Analysis</option>
                <option value="restoration">Restoration</option>
                <option value="permitting">Permitting</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium mb-1"
                >
                  Start Date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={project.startDate ?? ""}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium mb-1"
                >
                  End Date
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={project.endDate ?? ""}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="budget" className="block text-sm font-medium mb-1">
                Budget ($)
              </label>
              <input
                id="budget"
                name="budget"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  project.budgetCents != null
                    ? (project.budgetCents / 100).toFixed(2)
                    : ""
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/projects/${id}`)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-2 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
