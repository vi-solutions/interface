"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ApiResponse,
  InvoiceWithDetails,
  InvoiceLineItemDto,
} from "@interface/shared";
import { api } from "@/lib/api";
import { formatDateString } from "@/lib/dates";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import { InvoiceRoundingSummaryPanel } from "@/components/invoice-rounding-summary";
import { PageHeader, Button, Card, Badge, ErrorAlert } from "@/components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return formatDateString(
    iso,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    "en-CA",
  );
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function statusColor(
  status: string,
): "gray" | "blue" | "emerald" | "amber" | "red" {
  switch (status) {
    case "draft":
      return "gray";
    case "sent":
      return "blue";
    case "paid":
      return "emerald";
    case "void":
      return "red";
    default:
      return "gray";
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { authenticated } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editLineItems, setEditLineItems] = useState<InvoiceLineItemDto[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  useEffect(() => {
    if (!authenticated || !params.id) return;
    api<ApiResponse<InvoiceWithDetails>>(`/invoices/${params.id}`)
      .then((res) => setInvoice(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load invoice"),
      )
      .finally(() => setLoading(false));
  }, [authenticated, params.id]);

  if (!authenticated) return null;

  async function handleVoid() {
    if (!invoice) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/invoices/${invoice.id}`, { method: "DELETE" });
      router.push("/invoices");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to void invoice");
      setDeleting(false);
      setConfirmVoid(false);
    }
  }

  function startEditing() {
    if (!invoice) return;
    setEditLineItems(
      invoice.lineItems.map(({ type, description, quantity, unitCents }) => ({
        type,
        description,
        quantity: Number(quantity),
        unitCents: Number(unitCents),
      })),
    );
    setEditNotes(invoice.notes ?? "");
    setEditDueDate(invoice.dueDate?.slice(0, 10) ?? "");
    setError(null);
    setEditing(true);
  }

  function updateEditItem(
    index: number,
    field: "description" | "quantity" | "unitCents",
    value: string,
  ) {
    setEditLineItems((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "description") return { ...item, description: value };
        if (field === "quantity") {
          return { ...item, quantity: Number.parseFloat(value) || 0 };
        }
        return {
          ...item,
          unitCents: Math.round((Number.parseFloat(value) || 0) * 100),
        };
      }),
    );
  }

  async function handleSave() {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<ApiResponse<InvoiceWithDetails>>(
        `/invoices/${invoice.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            notes: editNotes || undefined,
            dueDate: editDueDate || undefined,
            lineItems: editLineItems,
          }),
        },
      );
      setInvoice(res.data);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  }

  const subtotalCents =
    invoice?.lineItems?.reduce((s, li) => s + Number(li.totalCents), 0) ?? 0;
  const roundingSummary =
    invoice?.roundingSummary && invoice.roundingSummary.employees.length > 0
      ? invoice.roundingSummary
      : null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href="/invoices"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1"
          >
            ← All Invoices
          </Link>
        </div>

        {loading && <p className="text-sm text-gray-400">Loading…</p>}

        {error && <ErrorAlert message={error} className="mb-6" />}

        {invoice && (
          <>
            <PageHeader
              title={invoice.project.name}
              subtitle={`${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`}
            >
              <Badge color={statusColor(invoice.status)}>
                {invoice.status}
              </Badge>
              {invoice.status !== "void" && (
                <>
                  {!editing && !confirmVoid && (
                    <Button onClick={startEditing}>Edit Invoice</Button>
                  )}
                  {confirmVoid ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600 dark:text-red-400">
                        Void this invoice?
                      </span>
                      <Button
                        variant="danger"
                        onClick={handleVoid}
                        disabled={deleting}
                      >
                        {deleting ? "Voiding…" : "Yes, void"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmVoid(false)}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : !editing ? (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmVoid(true)}
                    >
                      Void Invoice
                    </Button>
                  ) : null}
                </>
              )}
            </PageHeader>

            {editing ? (
              <Card className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold">Edit Invoice</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      QuickBooks invoice:{" "}
                      {invoice.qboInvoiceId
                        ? `#${invoice.qboInvoiceId}`
                        : "Not synced"}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums">
                    {formatMoney(
                      editLineItems.reduce(
                        (sum, item) =>
                          sum + Math.round(item.quantity * item.unitCents),
                        0,
                      ),
                    )}
                  </span>
                </div>

                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left pb-2 font-medium text-gray-500">Description</th>
                        <th className="text-right pb-2 font-medium text-gray-500 w-24">Qty</th>
                        <th className="text-right pb-2 font-medium text-gray-500 w-28">Rate</th>
                        <th className="text-right pb-2 font-medium text-gray-500 w-28">Amount</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {editLineItems.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 pr-3">
                            <input
                              value={item.description}
                              onChange={(e) => updateEditItem(index, "description", e.target.value)}
                              className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:outline-none py-1"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateEditItem(index, "quantity", e.target.value)}
                              className="w-full text-right bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:outline-none py-1"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={(item.unitCents / 100).toFixed(2)}
                              onChange={(e) => updateEditItem(index, "unitCents", e.target.value)}
                              className="w-full text-right bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:outline-none py-1"
                            />
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatMoney(Math.round(item.quantity * item.unitCents))}
                          </td>
                          <td className="py-2 pl-2">
                            <button
                              type="button"
                              aria-label="Remove line item"
                              onClick={() => setEditLineItems((items) => items.filter((_, i) => i !== index))}
                              className="text-gray-400 hover:text-red-500"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button
                  variant="secondary"
                  onClick={() =>
                    setEditLineItems((items) => [
                      ...items,
                      { type: "fee", description: "", quantity: 1, unitCents: 0 },
                    ])
                  }
                >
                  Add Line Item
                </Button>

                <div className="grid sm:grid-cols-2 gap-4 my-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                    <input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving || editLineItems.length === 0}
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            ) : (
            <>
            {/* Meta row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Project
                </p>
                <Link
                  href={`/projects/${invoice.projectId}`}
                  className="text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  {invoice.project.name}
                </Link>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Due Date
                </p>
                <p className="text-sm">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  QuickBooks Invoice
                </p>
                {invoice.qboInvoiceId ? (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    #{invoice.qboInvoiceId}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Not synced</span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Created
                </p>
                <p className="text-sm">
                  {formatDate(invoice.createdAt.toString())}
                </p>
              </div>
            </div>

            {roundingSummary && (
              <InvoiceRoundingSummaryPanel
                roundingSummary={roundingSummary}
                className="mb-6"
              />
            )}

            {/* Line items */}
            <Card padding={false} className="mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400 w-20">
                      Qty
                    </th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400 w-28">
                      Rate
                    </th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400 w-28">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li) => (
                    <tr
                      key={li.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                    >
                      <td className="px-5 py-3">
                        <span>{li.description}</span>
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                          {li.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {Number(li.quantity) % 1 === 0
                          ? Number(li.quantity)
                          : Number(li.quantity).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {formatMoney(Number(li.unitCents))}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">
                        {formatMoney(Number(li.totalCents))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td
                      colSpan={3}
                      className="px-5 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-400"
                    >
                      Subtotal
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-base">
                      {formatMoney(subtotalCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>

            {/* Notes */}
            {invoice.notes && (
              <Card className="mb-6">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Notes
                </p>
                <p className="text-sm">{invoice.notes}</p>
              </Card>
            )}
            </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
