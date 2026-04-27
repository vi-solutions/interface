"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  ProjectWithClient,
  TimeEntryWithUser,
  CreateTimeEntryDto,
  DocumentWithDetails,
  UserExpenseWithDetails,
  CreateUserExpenseDto,
  ProjectExpense,
  Milestone,
  ProjectContactWithDetails,
  Task,
  ProjectUserRateWithUser,
  User,
  ProjectNoteWithAuthor,
} from "@interface/shared";
import { api, apiUpload } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

export default function ProjectDetailPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectWithClient | null>(null);
  const [entries, setEntries] = useState<TimeEntryWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [userExpenses, setUserExpenses] = useState<UserExpenseWithDetails[]>(
    [],
  );
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectContacts, setProjectContacts] = useState<
    ProjectContactWithDetails[]
  >([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectUserRates, setProjectUserRates] = useState<
    ProjectUserRateWithUser[]
  >([]);
  const [notes, setNotes] = useState<ProjectNoteWithAuthor[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  const loadEntries = useCallback(() => {
    api<ApiListResponse<TimeEntryWithUser>>(`/time-entries?projectId=${id}`)
      .then((res) => setEntries(res.data))
      .catch(() => {});
  }, [id]);

  const loadDocuments = useCallback(() => {
    api<ApiListResponse<DocumentWithDetails>>(`/documents?projectId=${id}`)
      .then((res) => setDocuments(res.data))
      .catch(() => {});
  }, [id]);

  const loadUserExpenses = useCallback(() => {
    api<ApiListResponse<UserExpenseWithDetails>>(
      `/user-expenses?projectId=${id}`,
    )
      .then((res) => setUserExpenses(res.data))
      .catch(() => {});
  }, [id]);

  const loadProjectExpenses = useCallback(() => {
    api<ApiListResponse<ProjectExpense>>(`/project-expenses?projectId=${id}`)
      .then((res) => setProjectExpenses(res.data))
      .catch(() => {});
  }, [id]);

  const loadMilestones = useCallback(() => {
    api<ApiListResponse<Milestone>>(`/milestones?projectId=${id}`)
      .then((res) => setMilestones(res.data))
      .catch(() => {});
  }, [id]);

  const loadProjectContacts = useCallback(() => {
    api<ApiListResponse<ProjectContactWithDetails>>(
      `/project-contacts?projectId=${id}`,
    )
      .then((res) => setProjectContacts(res.data))
      .catch(() => {});
  }, [id]);

  const loadTimeCategories = useCallback(() => {
    api<ApiListResponse<Task>>(`/tasks?projectId=${id}`)
      .then((res) => setTasks(res.data))
      .catch(() => {});
  }, [id]);

  const loadProjectUserRates = useCallback(() => {
    api<ApiListResponse<ProjectUserRateWithUser>>(
      `/project-user-rates?projectId=${id}`,
    )
      .then((res) => setProjectUserRates(res.data))
      .catch(() => {});
  }, [id]);

  const loadNotes = useCallback(() => {
    api<ApiListResponse<ProjectNoteWithAuthor>>(
      `/project-notes?projectId=${id}`,
    )
      .then((res) => setNotes(res.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<ProjectWithClient>>(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load project"),
      );
    loadEntries();
    loadDocuments();
    loadUserExpenses();
    loadProjectExpenses();
    loadMilestones();
    loadProjectContacts();
    loadTimeCategories();
    loadProjectUserRates();
    loadNotes();
    api<ApiListResponse<User>>("/users")
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [
    authenticated,
    id,
    loadEntries,
    loadDocuments,
    loadUserExpenses,
    loadProjectExpenses,
    loadMilestones,
    loadProjectContacts,
    loadTimeCategories,
    loadProjectUserRates,
    loadNotes,
  ]);

  if (!authenticated) return null;

  // Group entries by user for the summary
  const byUser = entries.reduce<
    Record<string, { name: string; hours: number; billableHours: number }>
  >((acc, entry) => {
    const key = entry.userId;
    if (!acc[key]) {
      acc[key] = { name: entry.user.name, hours: 0, billableHours: 0 };
    }
    acc[key].hours += Number(entry.hours);
    if (entry.billable) acc[key].billableHours += Number(entry.hours);
    return acc;
  }, {});

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const totalBillable = entries.reduce(
    (sum, e) => sum + (e.billable ? Number(e.hours) : 0),
    0,
  );

  // Group entries by task for the hour summary
  const byTask = entries.reduce<
    Record<string, { name: string; hours: number }>
  >((acc, entry) => {
    const key = entry.task?.id ?? "_none";
    if (!acc[key]) {
      acc[key] = { name: entry.task?.name ?? "No Task", hours: 0 };
    }
    acc[key].hours += Number(entry.hours);
    return acc;
  }, {});

  // Build a rate lookup: userId -> hourly charge-out rate in cents
  const rateByUser: Record<string, number> = {};
  for (const u of users) {
    rateByUser[u.id] = u.rateCents; // default charge-out rate
  }
  for (const pur of projectUserRates) {
    if (pur.hourlyRateCents != null) {
      rateByUser[pur.userId] = pur.hourlyRateCents;
    }
  }

  // Build a cost lookup: userId -> hourly cost in cents
  const costByUser: Record<string, number> = {};
  for (const u of users) {
    costByUser[u.id] = u.hourlyCostCents;
  }

  // Revenue = sum of billable hours × charge-out rate
  const revenueCents = entries.reduce((sum, e) => {
    if (!e.billable) return sum;
    return sum + Number(e.hours) * (rateByUser[e.userId] ?? 0);
  }, 0);

  // Cost = sum of all hours × hourly wage + 15% burden (vacation, EI, CPP, etc.)
  const BURDEN_RATE = 1.15;
  const laborCostCents = entries.reduce((sum, e) => {
    return sum + Number(e.hours) * (costByUser[e.userId] ?? 0) * BURDEN_RATE;
  }, 0);

  const netProfitCents = revenueCents - laborCostCents;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const dto: CreateTimeEntryDto = {
      projectId: id,
      userId: currentUser?.isAdmin
        ? (form.get("userId") as string)
        : (currentUser?.id ?? ""),
      taskId: (form.get("taskId") as string) || undefined,
      date: form.get("date") as string,
      hours: parseFloat(form.get("hours") as string),
      description: (form.get("description") as string) || undefined,
      billable: form.get("billable") === "on",
    };

    try {
      await api<ApiResponse<TimeEntryWithUser>>("/time-entries", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Time entry added");
      setShowForm(false);
      loadEntries();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to save time entry",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entryId: string) {
    try {
      await api(`/time-entries/${entryId}`, { method: "DELETE" });
      addToast("Time entry deleted");
      loadEntries();
    } catch {
      addToast("Failed to delete entry", "error");
    }
  }

  async function handleDocDelete(docId: string) {
    try {
      await api(`/documents/${docId}`, { method: "DELETE" });
      addToast("Document removed");
      loadDocuments();
    } catch {
      addToast("Failed to remove document", "error");
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!project && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {project && (
          <>
            <div className="mb-6">
              <Link
                href="/projects"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back to Projects
              </Link>
            </div>

            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">
                  {project.code && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal mr-2">
                      {project.code}
                    </span>
                  )}
                  {project.name}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  <Link
                    href={`/clients/${project.client.id}`}
                    className="hover:underline"
                  >
                    {project.client.name}
                  </Link>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/projects/${id}/edit`}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Edit
                </Link>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                  {project.status}
                </span>
              </div>
            </div>

            {project.description && (
              <div className="mb-8">
                <p>{project.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 mb-10">
              {project.phase && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Phase
                  </h3>
                  <p className="mt-1 capitalize">{project.phase}</p>
                </div>
              )}
              {project.startDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Start Date
                  </h3>
                  <p className="mt-1">
                    {new Date(project.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.endDate && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    End Date
                  </h3>
                  <p className="mt-1">
                    {new Date(project.endDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.projectManager && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Project Manager
                  </h3>
                  <p className="mt-1">{project.projectManager.name}</p>
                </div>
              )}
              {projectContacts.length > 0 && (
                <div className="sm:col-span-2">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Contacts
                  </h3>
                  <div className="mt-1 space-y-1">
                    {projectContacts.map((pc) => (
                      <div
                        key={pc.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="font-medium">{pc.contact.name}</span>
                        {pc.contact.agency && (
                          <span className="text-gray-500 dark:text-gray-400">
                            — {pc.contact.agency}
                          </span>
                        )}
                        {pc.contact.title && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {pc.contact.agency
                              ? `, ${pc.contact.title}`
                              : `— ${pc.contact.title}`}
                          </span>
                        )}
                        {pc.contact.email && (
                          <a
                            href={`mailto:${pc.contact.email}`}
                            className="text-gray-400 dark:text-gray-500 hover:underline text-xs ml-auto"
                          >
                            {pc.contact.email}
                          </a>
                        )}
                        {pc.contact.phone && (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">
                            {pc.contact.phone}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Project Metrics ──────────────────────────────── */}
            {entries.length > 0 && (
              <div className="mb-10 space-y-6">
                {/* Financial summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Revenue
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      $
                      {(revenueCents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {totalBillable.toFixed(1)}h billable
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Labor Cost
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      $
                      {(laborCostCents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {totalHours.toFixed(1)}h total
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-4 ${
                      netProfitCents >= 0
                        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Net Profit
                    </p>
                    <p
                      className={`mt-1 text-xl font-bold tabular-nums ${
                        netProfitCents >= 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {netProfitCents < 0 ? "−" : ""}$
                      {(Math.abs(netProfitCents) / 100).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}
                    </p>
                    {revenueCents > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {((netProfitCents / revenueCents) * 100).toFixed(0)}%
                        margin
                      </p>
                    )}
                  </div>
                </div>
                {/* ── Notes ─────────────────────────────────────────── */}
                <section className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Notes</h2>
                    {!addingNote && (
                      <button
                        onClick={() => setAddingNote(true)}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
                      >
                        + Note
                      </button>
                    )}
                  </div>

                  {addingNote && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newNoteContent.trim()) return;
                        setSavingNote(true);
                        try {
                          await api<ApiResponse<ProjectNoteWithAuthor>>(
                            "/project-notes",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                projectId: id,
                                userId: currentUser!.id,
                                content: newNoteContent.trim(),
                              }),
                            },
                          );
                          setNewNoteContent("");
                          setAddingNote(false);
                          loadNotes();
                        } catch {
                          addToast("Failed to save note", "error");
                        } finally {
                          setSavingNote(false);
                        }
                      }}
                      className="mb-4"
                    >
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Add a note…"
                        rows={3}
                        autoFocus
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingNote(false);
                            setNewNoteContent("");
                          }}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingNote || !newNoteContent.trim()}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {savingNote ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                    {notes.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        No notes yet.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {notes.map((note) => {
                          const isEdited =
                            new Date(note.updatedAt).getTime() -
                              new Date(note.createdAt).getTime() >
                            2000;
                          const isEditing = editingNoteId === note.id;
                          const canEdit = currentUser?.id === note.userId;
                          const canDelete =
                            currentUser?.isAdmin ||
                            currentUser?.id === note.userId;

                          return (
                            <div
                              key={note.id}
                              className="border-l-2 border-emerald-500 pl-3 py-0.5"
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingNoteContent}
                                    onChange={(e) =>
                                      setEditingNoteContent(e.target.value)
                                    }
                                    rows={3}
                                    autoFocus
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        if (!editingNoteContent.trim()) return;
                                        try {
                                          await api<
                                            ApiResponse<ProjectNoteWithAuthor>
                                          >(`/project-notes/${note.id}`, {
                                            method: "PUT",
                                            body: JSON.stringify({
                                              content:
                                                editingNoteContent.trim(),
                                            }),
                                          });
                                          setEditingNoteId(null);
                                          loadNotes();
                                        } catch {
                                          addToast(
                                            "Failed to update note",
                                            "error",
                                          );
                                        }
                                      }}
                                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingNoteId(null)}
                                      className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-1">
                                  {note.content}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 ml-2">
                                <span className="font-medium text-gray-500 dark:text-gray-400">
                                  {note.author.name}
                                </span>
                                <span>·</span>
                                {isEdited ? (
                                  <span className="italic">
                                    edited{" "}
                                    <time dateTime={note.updatedAt}>
                                      {new Date(
                                        note.updatedAt,
                                      ).toLocaleString()}
                                    </time>
                                  </span>
                                ) : (
                                  <time dateTime={note.createdAt}>
                                    {new Date(note.createdAt).toLocaleString()}
                                  </time>
                                )}
                                {(canEdit || canDelete) && !isEditing && (
                                  <>
                                    <span>·</span>
                                    {canEdit && (
                                      <button
                                        onClick={() => {
                                          setEditingNoteId(note.id);
                                          setEditingNoteContent(note.content);
                                        }}
                                        className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                      >
                                        edit
                                      </button>
                                    )}
                                    {canEdit && canDelete && <span>·</span>}
                                    {canDelete && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await api(
                                              `/project-notes/${note.id}`,
                                              {
                                                method: "DELETE",
                                              },
                                            );
                                            loadNotes();
                                          } catch {
                                            addToast(
                                              "Failed to delete note",
                                              "error",
                                            );
                                          }
                                        }}
                                        className="hover:text-red-500 transition-colors"
                                      >
                                        delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
                {/* Milestones */}
                {milestones.length > 0 && (
                  <section className="mb-10">
                    <h2 className="text-lg font-semibold mb-4">Milestones</h2>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                      <div className="space-y-2">
                        {milestones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-sm">{m.name}</span>
                            {m.date ? (
                              <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                                {new Date(m.date).toLocaleDateString("en-CA")}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Documents ────────────────────────────────────── */}
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4">Documents</h2>

              {/* Upload dropzones per category */}
              {project.code && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <CategoryDropzone
                      key={cat}
                      category={cat}
                      projectId={id}
                      documents={documents.filter((d) => d.category === cat)}
                      onUploadComplete={loadDocuments}
                      onDelete={handleDocDelete}
                    />
                  ))}
                </div>
              )}

              {!project.code && (
                <div className="mb-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Set a project code on the{" "}
                  <Link
                    href={`/projects/${id}/edit`}
                    className="text-emerald-600 hover:underline"
                  >
                    edit page
                  </Link>{" "}
                  to enable file uploads with organized Drive folders.
                </div>
              )}

              {/* Uncategorized documents */}
              {documents.filter((d) => !d.category).length > 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50">
                  {documents
                    .filter((d) => !d.category)
                    .map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onDelete={handleDocDelete}
                      />
                    ))}
                </div>
              )}
            </section>

            {/* ── User Expenses ─────────────────────────────────── */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Expenses</h2>
                <button
                  onClick={() => setShowExpenseForm((v) => !v)}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
                >
                  {showExpenseForm ? "Cancel" : "+ Log Expense"}
                </button>
              </div>

              {showExpenseForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingExpense(true);
                    const form = new FormData(e.currentTarget);
                    const peId = form.get("projectExpenseId") as string;
                    const pe = projectExpenses.find((p) => p.id === peId);
                    const valueStr = form.get("amount") as string;
                    const value = parseFloat(valueStr);
                    let totalCents: number;
                    let quantity: number | undefined;

                    if (pe?.type === "dollar") {
                      totalCents = Math.round(value * 100);
                    } else {
                      quantity = value;
                      totalCents = Math.round(value * (pe?.rateCents ?? 0));
                    }

                    const dto: CreateUserExpenseDto = {
                      projectId: id,
                      userId: currentUser?.isAdmin
                        ? (form.get("userId") as string)
                        : (currentUser?.id ?? ""),
                      projectExpenseId: peId,
                      date: form.get("date") as string,
                      quantity,
                      totalCents,
                      notes: (form.get("notes") as string) || undefined,
                    };
                    try {
                      await api<ApiResponse<UserExpenseWithDetails>>(
                        "/user-expenses",
                        { method: "POST", body: JSON.stringify(dto) },
                      );
                      addToast("Expense logged");
                      setShowExpenseForm(false);
                      loadUserExpenses();
                    } catch (err) {
                      addToast(
                        err instanceof Error
                          ? err.message
                          : "Failed to log expense",
                        "error",
                      );
                    } finally {
                      setSavingExpense(false);
                    }
                  }}
                  className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Expense Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="projectExpenseId"
                      required
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select…</option>
                      {projectExpenses.map((pe) => (
                        <option key={pe.id} value={pe.id}>
                          {pe.name}{" "}
                          {pe.type !== "dollar" &&
                            `($${(pe.rateCents / 100).toFixed(2)}/${pe.type === "per_km" ? "km" : "day"})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentUser?.isAdmin ? (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Employee <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="userId"
                        required
                        defaultValue={currentUser?.id ?? ""}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select…</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Employee
                      </label>
                      <p className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm">
                        {currentUser?.name}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Amount ($) / Quantity{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Notes
                    </label>
                    <input
                      name="notes"
                      placeholder="Optional notes"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={savingExpense}
                      className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {savingExpense ? "Logging…" : "Log Expense"}
                    </button>
                  </div>
                </form>
              )}

              {userExpenses.length === 0 && !showExpenseForm ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No expenses logged yet. Click &quot;+ Log Expense&quot; to add
                  one.
                </p>
              ) : userExpenses.length > 0 ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Date
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Expense
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Employee
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Qty
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Total
                        </th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {userExpenses.map((ue) => (
                        <tr
                          key={ue.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <td className="px-4 py-2.5">
                            {new Date(ue.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 font-medium">
                            {ue.expenseName}
                            {ue.notes && (
                              <span className="block text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                {ue.notes}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {ue.user.name}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {ue.expenseType === "dollar"
                              ? "—"
                              : ue.quantity != null
                                ? `${Number(ue.quantity)}${ue.expenseType === "per_km" ? " km" : " days"}`
                                : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            ${(ue.totalCents / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={async () => {
                                try {
                                  await api(`/user-expenses/${ue.id}`, {
                                    method: "DELETE",
                                  });
                                  addToast("Expense deleted");
                                  loadUserExpenses();
                                } catch {
                                  addToast("Failed to delete expense", "error");
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Delete expense"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <td
                          colSpan={4}
                          className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400"
                        >
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                          $
                          {(
                            userExpenses.reduce(
                              (sum, ue) => sum + Number(ue.totalCents ?? 0),
                              0,
                            ) / 100
                          ).toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : null}
            </section>

            {/* ── Time Tracking ────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Time Tracking</h2>
                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
                >
                  {showForm ? "Cancel" : "+ Log Time"}
                </button>
              </div>

              {/* ── Add Entry Form ── */}
              {showForm && (
                <form
                  onSubmit={handleSubmit}
                  className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid gap-4 sm:grid-cols-2"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    {currentUser?.isAdmin ? (
                      <select
                        name="userId"
                        required
                        defaultValue={currentUser?.id ?? ""}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="">Select…</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                        {currentUser?.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Task
                    </label>
                    <select
                      name="taskId"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">No task</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toLocaleDateString("en-CA")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="hours"
                      type="number"
                      step="0.25"
                      min="0.25"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g. 2.5"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        name="billable"
                        type="checkbox"
                        defaultChecked
                        className="accent-emerald-600"
                      />
                      Billable
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <input
                      name="description"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="What did you work on?"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-emerald-600 px-6 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Entry"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Summary by Employee ── */}
              {entries.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Employee
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Billable
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Total Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byUser).map(([uid, info]) => (
                        <tr
                          key={uid}
                          className="border-b border-gray-100 dark:border-gray-700/50"
                        >
                          <td className="px-4 py-2.5">{info.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {info.billableHours.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {info.hours.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {totalBillable.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {totalHours.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── Summary by Task ── */}
              {tasks.length > 0 && entries.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Task
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Logged
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Budget
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Remaining
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => {
                        const logged = byTask[t.id]?.hours ?? 0;
                        const budget =
                          t.budgetHours != null ? Number(t.budgetHours) : null;
                        const remaining =
                          budget != null ? budget - logged : null;
                        return (
                          <tr
                            key={t.id}
                            className="border-b border-gray-100 dark:border-gray-700/50"
                          >
                            <td className="px-4 py-2.5">{t.name}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {logged.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {budget != null ? budget.toFixed(2) : "—"}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                                remaining != null && remaining < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                              }`}
                            >
                              {remaining != null ? remaining.toFixed(2) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {byTask["_none"] && (
                        <tr className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 italic">
                            No Task
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {byTask["_none"].hours.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            —
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Individual Entries ── */}
              {entries.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No time entries yet. Click &quot;+ Log Time&quot; to add one.
                </p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Date
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Task
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Employee
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Description
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Hours
                        </th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Billable
                        </th>
                        <th className="px-4 py-2.5">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {entry.task?.name || "—"}
                          </td>
                          <td className="px-4 py-2.5">{entry.user.name}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                            {entry.description || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {Number(entry.hours).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {entry.billable ? (
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="inline-block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              aria-label="Delete entry"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

const DOCUMENT_CATEGORIES = [
  "Project Management",
  "Correspondence",
  "Reference Documents",
  "Reporting",
  "Data",
  "Mapping",
] as const;

function CategoryDropzone({
  category,
  projectId,
  documents,
  onUploadComplete,
  onDelete,
}: {
  category: string;
  projectId: string;
  documents: DocumentWithDetails[];
  onUploadComplete: () => void;
  onDelete: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("projectId", projectId);
        fd.append("category", category);
        await apiUpload<ApiResponse<DocumentWithDetails>>(
          "/documents/upload",
          fd,
        );
      }
      addToast(
        `${files.length === 1 ? "File" : "Files"} uploaded to ${category}`,
      );
      onUploadComplete();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
        dragging
          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      }`}
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {category}
      </h3>

      {documents.length > 0 && (
        <ul className="space-y-1 mb-3">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 text-xs group">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-gray-400"
              >
                <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
              </svg>
              <a
                href={doc.googleDriveUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                {doc.name}
              </a>
              <button
                onClick={() => onDelete(doc.id)}
                className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                aria-label="Delete document"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex flex-col items-center cursor-pointer text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
        {uploading ? (
          <span className="text-xs">Uploading…</span>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6 mb-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
            <span className="text-xs">Drop files or click to upload</span>
          </>
        )}
        <input
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: DocumentWithDetails;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-8 w-8 shrink-0 ${
          doc.mimeType?.includes("spreadsheet")
            ? "text-green-500"
            : doc.mimeType?.includes("presentation")
              ? "text-yellow-500"
              : doc.mimeType?.includes("pdf")
                ? "text-red-500"
                : doc.mimeType?.includes("image")
                  ? "text-purple-500"
                  : "text-blue-500"
        }`}
      >
        <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
      </svg>
      <div className="min-w-0 flex-1">
        <a
          href={doc.googleDriveUrl ?? "#"}
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
          {doc.category && (
            <span className="ml-2 text-gray-400">· {doc.category}</span>
          )}
        </p>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
        aria-label="Remove document"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
