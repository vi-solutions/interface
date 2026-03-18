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
import {
  PageHeader,
  FormField,
  Input,
  Select,
  Textarea,
  Button,
  ErrorAlert,
} from "@/components/ui";

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
      setError(err instanceof Error ? err.message : "Failed to update project");
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

        <PageHeader title="Edit Project" />

        {error && <ErrorAlert message={error} />}

        {!project && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Client" htmlFor="clientId" required>
              <Select
                id="clientId"
                name="clientId"
                required
                defaultValue={project.clientId}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Project Name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                required
                defaultValue={project.name}
              />
            </FormField>

            <FormField label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project.description ?? ""}
              />
            </FormField>

            <FormField label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={project.status}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>

            <FormField label="Phase" htmlFor="phase">
              <Select
                id="phase"
                name="phase"
                defaultValue={project.phase ?? ""}
              >
                <option value="">None</option>
                <option value="assessment">Assessment</option>
                <option value="analysis">Analysis</option>
                <option value="restoration">Restoration</option>
                <option value="permitting">Permitting</option>
                <option value="reporting">Reporting</option>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" htmlFor="startDate">
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={project.startDate ?? ""}
                />
              </FormField>
              <FormField label="End Date" htmlFor="endDate">
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={project.endDate ?? ""}
                />
              </FormField>
            </div>

            <FormField label="Budget ($)" htmlFor="budget">
              <Input
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
                placeholder="0.00"
              />
            </FormField>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/projects/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
