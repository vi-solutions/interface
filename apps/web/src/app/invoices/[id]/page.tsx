"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse, InvoiceWithDetails } from "@interface/shared";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader, Button, Card, Badge, ErrorAlert } from "@/components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  const subtotalCents =
    invoice?.lineItems?.reduce((s, li) => s + Number(li.totalCents), 0) ?? 0;

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
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmVoid(true)}
                    >
                      Void Invoice
                    </Button>
                  )}
                </>
              )}
            </PageHeader>

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
                  QBO
                </p>
                {invoice.qboInvoiceId ? (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    ✓ Synced #{invoice.qboInvoiceId}
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
      </div>
    </AppShell>
  );
}
