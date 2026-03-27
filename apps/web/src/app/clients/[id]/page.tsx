"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  ApiListResponse,
  Client,
  ProjectWithClient,
  Contact,
  CreateContactDto,
} from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useToast } from "@/lib/toast-context";
import { AppShell } from "@/components/app-shell";

export default function ClientDetailPage() {
  const { authenticated } = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingTitle, setEditingTitle] = useState("");

  const loadContacts = useCallback(() => {
    api<ApiListResponse<Contact>>(`/contacts?clientId=${id}`)
      .then((res) => setContacts(res.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!authenticated) return;
    api<ApiResponse<Client>>(`/clients/${id}`)
      .then((res) => setClient(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load client"),
      );
    api<ApiListResponse<ProjectWithClient>>("/projects")
      .then((res) => setProjects(res.data.filter((p) => p.clientId === id)))
      .catch(() => {});
    loadContacts();
  }, [authenticated, id, loadContacts]);

  async function handleAddContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingContact(true);
    const form = new FormData(e.currentTarget);
    const dto: CreateContactDto = {
      clientId: id,
      name: form.get("name") as string,
      email: (form.get("email") as string) || undefined,
      phone: (form.get("phone") as string) || undefined,
      title: (form.get("title") as string) || undefined,
    };
    try {
      await api<ApiResponse<Contact>>("/contacts", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Contact added");
      setShowContactForm(false);
      loadContacts();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to add contact",
        "error",
      );
    } finally {
      setSavingContact(false);
    }
  }

  function startEditing(c: Contact) {
    setEditingContactId(c.id);
    setEditingName(c.name);
    setEditingEmail(c.email ?? "");
    setEditingPhone(c.phone ?? "");
    setEditingTitle(c.title ?? "");
  }

  async function handleSaveEdit(contactId: string) {
    try {
      await api(`/contacts/${contactId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingName,
          email: editingEmail || null,
          phone: editingPhone || null,
          title: editingTitle || null,
        }),
      });
      addToast("Contact updated");
      setEditingContactId(null);
      loadContacts();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to update contact",
        "error",
      );
    }
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await api(`/contacts/${contactId}`, { method: "DELETE" });
      addToast("Contact removed");
      loadContacts();
    } catch {
      addToast("Failed to remove contact", "error");
    }
  }

  if (!authenticated) return null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        {error && (
          <p className="text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4">
            {error}
          </p>
        )}

        {!client && !error && (
          <p className="text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {client && (
          <>
            <div className="mb-6">
              <Link
                href="/clients"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                ← Back to Clients
              </Link>
            </div>

            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <Link
                href={`/clients/${id}/edit`}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Edit
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 mb-8">
              {client.contactName && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Contact
                  </h3>
                  <p className="mt-1">{client.contactName}</p>
                </div>
              )}
              {client.contactEmail && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Email
                  </h3>
                  <p className="mt-1">{client.contactEmail}</p>
                </div>
              )}
              {client.contactPhone && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Phone
                  </h3>
                  <p className="mt-1">{client.contactPhone}</p>
                </div>
              )}
              {client.address && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Address
                  </h3>
                  <p className="mt-1">{client.address}</p>
                </div>
              )}
              {client.notes && (
                <div className="sm:col-span-2">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Notes
                  </h3>
                  <p className="mt-1">{client.notes}</p>
                </div>
              )}
            </div>

            {/* ── Contacts ── */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Contacts</h2>
                <button
                  onClick={() => setShowContactForm(!showContactForm)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  {showContactForm ? "Cancel" : "+ Add Contact"}
                </button>
              </div>

              {showContactForm && (
                <form
                  onSubmit={handleAddContact}
                  className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="name"
                        required
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Title
                      </label>
                      <input
                        name="title"
                        placeholder="e.g. Project Manager"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Email
                      </label>
                      <input
                        name="email"
                        type="email"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Phone
                      </label>
                      <input
                        name="phone"
                        type="tel"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingContact}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {savingContact ? "Saving…" : "Add Contact"}
                    </button>
                  </div>
                </form>
              )}

              {contacts.length === 0 && !showContactForm ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No contacts yet. Click &quot;+ Add Contact&quot; to add one.
                </p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Name
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Title
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Email
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                          Phone
                        </th>
                        <th className="w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-gray-100 dark:border-gray-700/50"
                        >
                          {editingContactId === c.id ? (
                            <>
                              <td className="px-4 py-2">
                                <input
                                  value={editingName}
                                  onChange={(e) =>
                                    setEditingName(e.target.value)
                                  }
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  value={editingTitle}
                                  onChange={(e) =>
                                    setEditingTitle(e.target.value)
                                  }
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  value={editingEmail}
                                  onChange={(e) =>
                                    setEditingEmail(e.target.value)
                                  }
                                  type="email"
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  value={editingPhone}
                                  onChange={(e) =>
                                    setEditingPhone(e.target.value)
                                  }
                                  type="tel"
                                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={() => handleSaveEdit(c.id)}
                                  className="text-emerald-600 hover:text-emerald-700 text-xs font-medium mr-2"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingContactId(null)}
                                  className="text-gray-400 hover:text-gray-600 text-xs"
                                >
                                  Cancel
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2.5 font-medium">
                                {c.name}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                                {c.title || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                                {c.email ? (
                                  <a
                                    href={`mailto:${c.email}`}
                                    className="hover:underline"
                                  >
                                    {c.email}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                                {c.phone || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => startEditing(c)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mr-2"
                                  aria-label="Edit contact"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="h-4 w-4"
                                  >
                                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25h5.5a.75.75 0 0 0 0-1.5h-5.5A2.75 2.75 0 0 0 2 5.75v8.5A2.75 2.75 0 0 0 4.75 17h8.5A2.75 2.75 0 0 0 16 14.25v-5.5a.75.75 0 0 0-1.5 0v5.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-8.5Z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteContact(c.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  aria-label="Delete contact"
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
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {projects.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Projects</h2>
                <div className="grid gap-4">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{project.name}</h3>
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-1">
                          {project.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
