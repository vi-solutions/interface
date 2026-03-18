"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type {
  ApiListResponse,
  ApiResponse,
  DocumentWithDetails,
  CreateDocumentDto,
  ProjectWithClient,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

export default function DocumentsPage() {
  const { authenticated } = useRequireAuth();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDocuments = useCallback(() => {
    api<ApiListResponse<DocumentWithDetails>>("/documents")
      .then((res) => setDocuments(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadDocuments();
    api<ApiListResponse<ProjectWithClient>>("/projects")
      .then((res) => setProjects(res.data))
      .catch(() => {});
  }, [authenticated, loadDocuments]);

  if (!authenticated) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateDocumentDto = {
      projectId: form.get("projectId") as string,
      name: form.get("name") as string,
      googleDriveUrl: form.get("googleDriveUrl") as string,
      mimeType: (form.get("mimeType") as string) || undefined,
    };

    try {
      await api<ApiResponse<DocumentWithDetails>>("/documents", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Document linked successfully");
      setShowForm(false);
      loadDocuments();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to add document",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(docId: string) {
    try {
      await api(`/documents/${docId}`, { method: "DELETE" });
      addToast("Document removed");
      loadDocuments();
    } catch {
      addToast("Failed to remove document", "error");
    }
  }

  // Group by project
  const byProject = documents.reduce<
    Record<string, { projectName: string; docs: DocumentWithDetails[] }>
  >((acc, doc) => {
    if (!acc[doc.projectId]) {
      acc[doc.projectId] = { projectName: doc.projectName, docs: [] };
    }
    acc[doc.projectId].docs.push(doc);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Documents</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            {showForm ? "Cancel" : "+ Link Document"}
          </button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
          Link Google Drive documents to your projects.
        </p>

        {/* Add Document Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Document Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                required
                placeholder="e.g. Site Assessment Report"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Google Drive URL <span className="text-red-500">*</span>
              </label>
              <input
                name="googleDriveUrl"
                type="url"
                required
                placeholder="https://drive.google.com/file/d/..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                name="mimeType"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Auto-detect</option>
                <option value="application/pdf">PDF</option>
                <option value="application/vnd.google-apps.document">
                  Google Doc
                </option>
                <option value="application/vnd.google-apps.spreadsheet">
                  Google Sheet
                </option>
                <option value="application/vnd.google-apps.presentation">
                  Google Slides
                </option>
                <option value="image/jpeg">Image (JPEG)</option>
                <option value="image/png">Image (PNG)</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                  Word Document
                </option>
                <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
                  Excel Spreadsheet
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Linking…" : "Link Document"}
              </button>
            </div>
          </form>
        )}

        {/* Documents List */}
        {Object.keys(byProject).length === 0 && !showForm && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <DriveIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No documents linked yet.</p>
            <p className="text-sm mt-1">
              Click &quot;+ Link Document&quot; to add a Google Drive document.
            </p>
          </div>
        )}

        {Object.entries(byProject).map(([projectId, group]) => (
          <div key={projectId} className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              <Link
                href={`/projects/${projectId}`}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {group.projectName}
              </Link>
            </h2>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
              {group.docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <DocTypeIcon mimeType={doc.mimeType} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={doc.googleDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block"
                    >
                      {doc.name}
                      <span className="ml-1.5 text-gray-400 text-xs">↗</span>
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Added by {doc.uploadedByName} ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString()}
                      {doc.mimeType && (
                        <>
                          {" · "}
                          {friendlyMimeType(doc.mimeType)}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove document"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function friendlyMimeType(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Word",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Excel",
  };
  return map[mime] ?? mime;
}

/* ---------- Icons ---------- */

function DriveIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M7.71 3.5L1.15 15l4.58 7.5h6.57L5.73 11 9.28 5 7.71 3.5zm1.57 1L15.85 15H22.85l-4.57-7.5L12.71 3.5H9.28zm6.57 0L9.28 15l4.57 7.5h6.57l-4.57-7.5L22.42 4.5h-6.57z" />
    </svg>
  );
}

function DocTypeIcon({
  mimeType,
  className,
}: {
  mimeType: string | null;
  className?: string;
}) {
  const color = mimeType?.includes("spreadsheet")
    ? "text-green-500"
    : mimeType?.includes("presentation")
      ? "text-yellow-500"
      : mimeType?.includes("pdf")
        ? "text-red-500"
        : mimeType?.includes("image")
          ? "text-purple-500"
          : "text-blue-500";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`${color} ${className ?? ""}`}
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.797l-.5 6a.75.75 0 0 1-1.497-.124l.5-6a.75.75 0 0 1 .797-.673Zm3.638.797a.75.75 0 0 0-1.497-.124l-.5 6a.75.75 0 0 0 1.497.124l.5-6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
