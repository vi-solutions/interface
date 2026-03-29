"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api } from "@/lib/api";
import type {
  ApiResponse,
  ApiListResponse,
  Client,
  Project,
  CreateProjectDto,
  ProjectPhase,
  User,
} from "@interface/shared";
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
import { useToast } from "@/lib/toast-context";

export default function NewProjectPage() {
  const { authenticated } = useRequireAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiListResponse<Client>>("/clients")
      .then((res) => setClients(res.data))
      .catch(() => {});
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [authenticated]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const budgetStr = form.get("budget") as string;
    const dto: CreateProjectDto = {
      clientId: form.get("clientId") as string,
      name: form.get("name") as string,
      code: (form.get("code") as string) || undefined,
      description: (form.get("description") as string) || undefined,
      phase: ((form.get("phase") as string) || undefined) as
        | ProjectPhase
        | undefined,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      budgetCents: budgetStr
        ? Math.round(parseFloat(budgetStr) * 100)
        : undefined,
      projectManagerId: (form.get("projectManagerId") as string) || undefined,
    };

    try {
      await api<ApiResponse<Project>>("/projects", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Project created successfully");
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8">
        <PageHeader title="New Project" />

        {error && <ErrorAlert message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Client" htmlFor="clientId" required>
            <Select id="clientId" name="clientId" required>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Project Name" htmlFor="name" required>
            <Input id="name" name="name" required />
          </FormField>

          <FormField label="Project Code" htmlFor="code">
            <Input id="code" name="code" placeholder="e.g. 2026-99-001" />
          </FormField>

          <FormField label="Description" htmlFor="description">
            <Textarea id="description" name="description" rows={3} />
          </FormField>

          <FormField label="Phase" htmlFor="phase">
            <Select id="phase" name="phase">
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
              <Input id="startDate" name="startDate" type="date" />
            </FormField>
            <FormField label="End Date" htmlFor="endDate">
              <Input id="endDate" name="endDate" type="date" />
            </FormField>
          </div>

          <FormField label="Budget ($)" htmlFor="budget">
            <Input
              id="budget"
              name="budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Project Manager" htmlFor="projectManagerId">
            <Select id="projectManagerId" name="projectManagerId">
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create Project"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/projects")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
