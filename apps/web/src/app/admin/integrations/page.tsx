"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ApiResponse,
  ApiListResponse,
  QboConnection,
  GoogleDriveConnection,
  HarvestStatus,
  HarvestProjectMapping,
  Project,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button, ErrorAlert } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function IntegrationsPageContent() {
  const { authenticated } = useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<QboConnection | null>(null);
  const [driveConn, setDriveConn] = useState<GoogleDriveConnection | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [driveLoading, setDriveLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Harvest state
  const [harvestStatus, setHarvestStatus] = useState<HarvestStatus | null>(
    null,
  );
  const [harvestMappings, setHarvestMappings] = useState<
    HarvestProjectMapping[]
  >([]);
  const [harvestProjects, setHarvestProjects] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [appProjects, setAppProjects] = useState<Project[]>([]);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [newHarvestProjectId, setNewHarvestProjectId] = useState("");
  const [newHarvestProjectName, setNewHarvestProjectName] = useState("");
  const [newAppProjectId, setNewAppProjectId] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);
  const [harvestProjectsLoading, setHarvestProjectsLoading] = useState(false);

  // Root folder picker state
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [folderNavStack, setFolderNavStack] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    if (user && !user.isAdmin) {
      router.replace("/");
      return;
    }

    if (searchParams.get("qbo") === "connected") {
      addToast("QuickBooks connected successfully");
    }
    if (searchParams.get("gdrive") === "connected") {
      addToast("Google Drive connected successfully");
    }

    api<ApiResponse<QboConnection | null>>("/quickbooks/status")
      .then((res) => setConnection(res.data))
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load connection status",
        ),
      )
      .finally(() => setLoading(false));

    api<ApiResponse<GoogleDriveConnection | null>>("/google-drive/status")
      .then((res) => setDriveConn(res.data))
      .catch(() => {})
      .finally(() => setDriveLoading(false));

    api<HarvestStatus>("/harvest/status")
      .then((s) => setHarvestStatus(s))
      .catch(() => {});

    api<HarvestProjectMapping[]>("/harvest/mappings")
      .then((m) => setHarvestMappings(m))
      .catch(() => {});

    api<ApiListResponse<Project>>("/projects")
      .then((res) => setAppProjects(res.data))
      .catch(() => {});
  }, [authenticated, user, router, searchParams, addToast]);

  async function handleDisconnect() {
    try {
      await api("/quickbooks/disconnect", { method: "DELETE" });
      setConnection(null);
      addToast("QuickBooks disconnected");
    } catch (e) {
      addToast(
        e instanceof Error ? e.message : "Failed to disconnect",
        "error",
      );
    }
  }

  async function handleDriveDisconnect() {
    try {
      await api("/google-drive/disconnect", { method: "DELETE" });
      setDriveConn(null);
      addToast("Google Drive disconnected");
    } catch (e) {
      addToast(
        e instanceof Error ? e.message : "Failed to disconnect",
        "error",
      );
    }
  }

  async function loadFolders(parentId?: string) {
    setFoldersLoading(true);
    try {
      const url = parentId
        ? `/google-drive/folders?parentId=${parentId}`
        : "/google-drive/folders";
      const res =
        await api<ApiResponse<Array<{ id: string; name: string }>>>(url);
      setFolders(res.data);
    } catch {
      addToast("Failed to load folders", "error");
    } finally {
      setFoldersLoading(false);
    }
  }

  function openFolderPicker() {
    setShowFolderPicker(true);
    setFolderNavStack([]);
    loadFolders();
  }

  function navigateInto(folder: { id: string; name: string }) {
    setFolderNavStack((s) => [...s, folder]);
    loadFolders(folder.id);
  }

  function navigateBack() {
    const newStack = folderNavStack.slice(0, -1);
    setFolderNavStack(newStack);
    const parent = newStack[newStack.length - 1];
    loadFolders(parent?.id);
  }

  async function selectRootFolder(folderId: string, folderName: string) {
    try {
      await api("/google-drive/root-folder", {
        method: "POST",
        body: JSON.stringify({ folderId }),
      });
      setDriveConn((c) => (c ? { ...c, rootFolderId: folderId } : c));
      setShowFolderPicker(false);
      addToast(`Root folder set to "${folderName}"`);
    } catch {
      addToast("Failed to set root folder", "error");
    }
  }

  async function openAddMapping() {
    setShowAddMapping(true);
    setNewHarvestProjectId("");
    setNewHarvestProjectName("");
    setNewAppProjectId("");
    if (harvestStatus?.credentialsConfigured && harvestProjects.length === 0) {
      setHarvestProjectsLoading(true);
      try {
        const projects = await api<Array<{ id: number; name: string }>>(
          "/harvest/harvest-projects",
        );
        setHarvestProjects(projects);
      } catch {
        addToast("Could not load Harvest projects", "error");
      } finally {
        setHarvestProjectsLoading(false);
      }
    }
  }

  async function handleAddMapping() {
    if (!newHarvestProjectId || !newAppProjectId) return;
    setSavingMapping(true);
    try {
      await api("/harvest/mappings", {
        method: "POST",
        body: JSON.stringify({
          harvestProjectId: newHarvestProjectId,
          harvestProjectName: newHarvestProjectName,
          appProjectId: newAppProjectId,
        }),
      });
      const updated = await api<HarvestProjectMapping[]>("/harvest/mappings");
      setHarvestMappings(updated);
      setShowAddMapping(false);
      addToast("Mapping saved");
    } catch (e) {
      addToast(
        e instanceof Error ? e.message : "Failed to save mapping",
        "error",
      );
    } finally {
      setSavingMapping(false);
    }
  }

  async function handleDeleteMapping(harvestProjectId: string) {
    try {
      await api(`/harvest/mappings/${harvestProjectId}`, { method: "DELETE" });
      setHarvestMappings((m) =>
        m.filter((x) => x.harvestProjectId !== harvestProjectId),
      );
      addToast("Mapping removed");
    } catch {
      addToast("Failed to remove mapping", "error");
    }
  }

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <PageHeader title="Integrations" />

        {error && <ErrorAlert message={error} />}

        {/* QuickBooks Online */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <QboLogo className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  QuickBooks Online
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sync time entries and expenses automatically
                </p>
              </div>
            </div>

            {loading ? (
              <span className="text-sm text-gray-400">Loading…</span>
            ) : connection ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Connected
                </span>
                <Button variant="secondary" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <a
                href={`${API_BASE}/quickbooks/connect`}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Connect
              </a>
            )}
          </div>

          {connection && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    Connected since
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(connection.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    Token expires
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(
                      connection.refreshTokenExpiresAt,
                    ).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                Link your clients to QBO customers on each client's detail page.
                Time entries and expenses will sync automatically.
              </p>
            </div>
          )}
        </div>

        {/* Google Drive */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <DriveLogo className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Google Drive
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload project documents to organized Drive folders
                </p>
              </div>
            </div>

            {driveLoading ? (
              <span className="text-sm text-gray-400">Loading…</span>
            ) : driveConn ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Connected
                </span>
                <Button variant="secondary" onClick={handleDriveDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <a
                href={`${API_BASE}/google-drive/connect`}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Connect
              </a>
            )}
          </div>

          {driveConn && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Root folder:{" "}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {driveConn.rootFolderId ? "Set" : "Not set"}
                  </span>
                </div>
                <Button variant="secondary" onClick={openFolderPicker}>
                  {driveConn.rootFolderId
                    ? "Change Root Folder"
                    : "Set Root Folder"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                Project folders will be created inside the root folder. Each
                project needs a code (e.g. 2026-99-001) for folder naming.
              </p>

              {showFolderPicker && (
                <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {folderNavStack.length > 0 && (
                      <button
                        onClick={navigateBack}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        ← Back
                      </button>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {folderNavStack.length > 0
                        ? folderNavStack.map((f) => f.name).join(" / ")
                        : "My Drive"}
                    </span>
                  </div>

                  {folderNavStack.length > 0 && (
                    <button
                      onClick={() => {
                        const current =
                          folderNavStack[folderNavStack.length - 1];
                        selectRootFolder(current.id, current.name);
                      }}
                      className="mb-3 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Select this folder
                    </button>
                  )}

                  {foldersLoading ? (
                    <p className="text-sm text-gray-400">Loading folders…</p>
                  ) : folders.length === 0 ? (
                    <p className="text-sm text-gray-400">No subfolders</p>
                  ) : (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {folders.map((f) => (
                        <li key={f.id}>
                          <button
                            onClick={() => navigateInto(f)}
                            className="w-full text-left px-3 py-2 rounded-md text-sm hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2"
                          >
                            <FolderIcon className="h-4 w-4 text-gray-400" />
                            {f.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => setShowFolderPicker(false)}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Harvest */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/30">
              <HarvestLogo className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Harvest
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Map Harvest projects to app projects for time &amp; expense
                import
              </p>
            </div>
            {harvestStatus &&
              (harvestStatus.credentialsConfigured ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Credentials set
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  No credentials
                </span>
              ))}
          </div>

          {harvestStatus && !harvestStatus.credentialsConfigured && (
            <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              Set{" "}
              <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">
                HARVEST_TOKEN
              </code>{" "}
              and{" "}
              <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">
                HARVEST_ACCOUNT_ID
              </code>{" "}
              environment variables on the server to enable Harvest integration.
            </div>
          )}

          {/* Mappings table */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                    Harvest project
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                    App project
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {harvestMappings.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-sm text-gray-400"
                    >
                      No project mappings yet.
                    </td>
                  </tr>
                )}
                {harvestMappings.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium">
                        {m.harvestProjectName || m.harvestProjectId}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        #{m.harvestProjectId}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                      {m.appProjectName ?? (
                        <span className="text-red-400 italic">
                          project not found
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteMapping(m.harvestProjectId)}
                        className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add mapping form */}
          {showAddMapping ? (
            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add project mapping
              </p>

              {harvestStatus?.credentialsConfigured ? (
                harvestProjectsLoading ? (
                  <p className="text-sm text-gray-400">
                    Loading Harvest projects…
                  </p>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Harvest project
                    </label>
                    <select
                      value={newHarvestProjectId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const p = harvestProjects.find(
                          (x) => String(x.id) === id,
                        );
                        setNewHarvestProjectId(id);
                        setNewHarvestProjectName(p?.name ?? "");
                      }}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    >
                      <option value="">Select a Harvest project…</option>
                      {harvestProjects.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Harvest project ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12345678"
                      value={newHarvestProjectId}
                      onChange={(e) => setNewHarvestProjectId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Harvest project name (label)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. My Project"
                      value={newHarvestProjectName}
                      onChange={(e) => setNewHarvestProjectName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  App project
                </label>
                <select
                  value={newAppProjectId}
                  onChange={(e) => setNewAppProjectId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                >
                  <option value="">Select an app project…</option>
                  {appProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.code ? ` (${p.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddMapping}
                  disabled={
                    savingMapping || !newHarvestProjectId || !newAppProjectId
                  }
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {savingMapping ? "Saving…" : "Save mapping"}
                </button>
                <button
                  onClick={() => setShowAddMapping(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openAddMapping}
              className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
            >
              + Add mapping
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsPageContent />
    </Suspense>
  );
}

function QboLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="14" fill="#2CA01C" />
      <path
        d="M10.5 11C8.567 11 7 12.567 7 14.5v3C7 19.433 8.567 21 10.5 21H12v-2h-1.5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 10.5 13H13v8h2V11h-4.5ZM21.5 11H19v2h1.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H19v-8h-2v10h4.5c1.933 0 3.5-1.567 3.5-3.5v-3c0-1.933-1.567-3.5-3.5-3.5Z"
        fill="white"
      />
    </svg>
  );
}

function DriveLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066DA"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"
        fill="#00AC47"
      />
      <path
        d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.95 10.3z"
        fill="#EA4335"
      />
      <path
        d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832D"
      />
      <path
        d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h36.85c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684FC"
      />
      <path
        d="M73.4 26.5 60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.6 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5z"
        fill="#FFBA00"
      />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.06-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
      />
    </svg>
  );
}

function HarvestLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="16" fill="#FA6432" />
      <path d="M9 8h2.8v6.6H20V8h2.8v16H20v-7H11.8v7H9z" fill="#ffffff" />
    </svg>
  );
}
