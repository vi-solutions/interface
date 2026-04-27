"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  ApiResponse,
  ApiListResponse,
  Contact,
  CreateContactDto,
  UpdateContactDto,
  Client,
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
  Button,
  ErrorAlert,
  EmptyState,
} from "@/components/ui";

export default function ContactsPage() {
  const { authenticated } = useRequireAuth();
  const { addToast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    name: string;
    title: string;
    agency: string;
    email: string;
    phone: string;
    clientId: string;
  }>({ name: "", title: "", agency: "", email: "", phone: "", clientId: "" });

  const loadContacts = useCallback(() => {
    api<ApiListResponse<Contact>>("/contacts")
      .then((res) => setContacts(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadContacts();
    api<ApiListResponse<Client>>("/clients")
      .then((res) => setClients(res.data))
      .catch(() => {});
  }, [authenticated, loadContacts]);

  if (!authenticated) return null;

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setEditFields({
      name: c.name,
      title: c.title ?? "",
      agency: c.agency ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      clientId: c.clientId ?? "",
    });
  }

  async function saveEdit(id: string) {
    const dto: UpdateContactDto = {
      name: editFields.name || undefined,
      title: editFields.title || null,
      agency: editFields.agency || null,
      email: editFields.email || null,
      phone: editFields.phone || null,
    };
    try {
      await api<ApiResponse<Contact>>(`/contacts/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });
      addToast("Contact updated");
      setEditingId(null);
      loadContacts();
    } catch {
      addToast("Failed to update contact", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/contacts/${id}`, { method: "DELETE" });
      addToast("Contact deleted");
      loadContacts();
    } catch {
      addToast("Failed to delete contact", "error");
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const dto: CreateContactDto = {
      name: form.get("name") as string,
      title: (form.get("title") as string) || undefined,
      agency: (form.get("agency") as string) || undefined,
      email: (form.get("email") as string) || undefined,
      phone: (form.get("phone") as string) || undefined,
      clientId: (form.get("clientId") as string) || undefined,
    };
    try {
      await api<ApiResponse<Contact>>("/contacts", {
        method: "POST",
        body: JSON.stringify(dto),
      });
      addToast("Contact added");
      setShowForm(false);
      loadContacts();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <PageHeader title="Contacts">
          <Button
            onClick={() => setShowForm((v) => !v)}
            variant={showForm ? "secondary" : "primary"}
          >
            {showForm ? "Cancel" : "+ New Contact"}
          </Button>
        </PageHeader>

        {error && <ErrorAlert message={error} />}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 grid gap-4 sm:grid-cols-2"
          >
            <FormField label="Name" htmlFor="name" required>
              <Input id="name" name="name" required />
            </FormField>
            <FormField label="Agency / Organization" htmlFor="agency">
              <Input id="agency" name="agency" placeholder="e.g. BCMOE" />
            </FormField>
            <FormField label="Title" htmlFor="title">
              <Input
                id="title"
                name="title"
                placeholder="e.g. Project Manager"
              />
            </FormField>
            <FormField label="Client" htmlFor="clientId">
              <Select id="clientId" name="clientId">
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" />
            </FormField>
            <div className="sm:col-span-2 flex gap-3 pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add Contact"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {contacts.length === 0 && !showForm ? (
          <EmptyState message="No contacts yet." />
        ) : contacts.length > 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                    Name
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                    Agency
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
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                    Client
                  </th>
                  <th className="w-24 px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) =>
                  editingId === c.id ? (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 bg-gray-50 dark:bg-gray-800/60"
                    >
                      <td className="px-4 py-2">
                        <input
                          autoFocus
                          value={editFields.name}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editFields.agency}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              agency: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editFields.title}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              title: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="email"
                          value={editFields.email}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              email: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="tel"
                          value={editFields.phone}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              phone: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editFields.clientId}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              clientId: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">None</option>
                          {clients.map((cl) => (
                            <option key={cl.id} value={cl.id}>
                              {cl.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => saveEdit(c.id)}
                            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 text-sm font-medium transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                        {c.agency ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                        {c.title ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="hover:underline"
                          >
                            {c.email}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                        {c.phone ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                        {c.clientId ? (
                          (clients.find((cl) => cl.id === c.clientId)?.name ??
                          "—")
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Edit"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.303a1 1 0 0 0-.258.46l-.67 2.68a.75.75 0 0 0 .915.915l2.68-.67a1 1 0 0 0 .46-.258l7.79-7.793a1.75 1.75 0 0 0 0-2.475l-.649-.649Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
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
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
