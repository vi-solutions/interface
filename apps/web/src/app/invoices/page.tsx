"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type {
  ApiListResponse,
  ApiResponse,
  InvoiceListItem,
  InvoiceWithDetails,
  InvoicePreview,
  InvoiceLineItemDto,
  ProjectWithClient,
} from "@interface/shared";
import { api } from "@/lib/api";
import { dateToDateInputValue, formatDateString } from "@/lib/dates";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InvoiceRoundingSummaryPanel } from "@/components/invoice-rounding-summary";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  ErrorAlert,
} from "@/components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date) {
  return dateToDateInputValue(d);
}

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

function recentMonths(): { label: string; start: string; end: string }[] {
  const months: { label: string; start: string; end: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = fmt(new Date(y, m, 1));
    const end = fmt(new Date(y, m + 1, 0));
    const label = d.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
    });
    months.push({ label, start, end });
  }
  return months;
}

// ── Step 1: project + period picker ──────────────────────────────────────────

function NewInvoiceForm({
  projects,
  onPreview,
  onCancel,
}: {
  projects: ProjectWithClient[];
  onPreview: (
    projectId: string,
    periodStart: string,
    periodEnd: string,
  ) => void;
  onCancel: () => void;
}) {
  const months = recentMonths();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [period, setPeriod] = useState(`${months[1].start}|${months[1].end}`);
  const [customStart, setCustomStart] = useState(months[1].start);
  const [customEnd, setCustomEnd] = useState(months[1].end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    const [start, end] =
      mode === "custom" ? [customStart, customEnd] : period.split("|");
    setLoading(true);
    setError(null);
    try {
      await onPreview(projectId, start, end);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
        New Invoice
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Billing period
          </label>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setMode("preset")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                mode === "preset"
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                mode === "custom"
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Custom range
            </button>
          </div>
        </div>

        {mode === "preset" ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              &nbsp;
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {months.map((m) => (
                <option key={m.start} value={`${m.start}|${m.end}`}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              &nbsp;
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handlePreview} disabled={loading || !projectId}>
            {loading ? "Loading…" : "Preview"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
      {error && <ErrorAlert message={error} className="mt-3" />}
    </Card>
  );
}

// ── Step 2: editable line items preview ──────────────────────────────────────

function InvoicePreviewStep({
  preview,
  onSubmit,
  onBack,
}: {
  preview: InvoicePreview;
  onSubmit: (
    lineItems: InvoiceLineItemDto[],
    notes: string,
    dueDate: string,
  ) => void;
  onBack: () => void;
}) {
  const [lineItems, setLineItems] = useState<InvoiceLineItemDto[]>(
    preview.lineItems,
  );
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    // Default: 30 days after period end
    const d = new Date(preview.periodEnd);
    d.setDate(d.getDate() + 30);
    return fmt(d);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeLabel, setFeeLabel] = useState("Admin fee");
  const [feePct, setFeePct] = useState("10");
  const [feeBase, setFeeBase] = useState<"all" | "time" | "expense">("time");

  function updateItem(
    idx: number,
    field: "description" | "quantity" | "unitCents",
    value: string,
  ) {
    setLineItems((prev) =>
      prev.map((li, i) => {
        if (i !== idx) return li;
        if (field === "quantity")
          return { ...li, quantity: parseFloat(value) || 0 };
        if (field === "unitCents")
          return {
            ...li,
            unitCents: Math.round((parseFloat(value) || 0) * 100),
          };
        return { ...li, [field]: value };
      }),
    );
  }

  function removeItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addBlankItem() {
    setLineItems((prev) => [
      ...prev,
      { type: "fee", description: "", quantity: 1, unitCents: 0 },
    ]);
  }

  function addFee() {
    const pct = parseFloat(feePct) || 0;
    const baseCents = lineItems
      .filter((li) => feeBase === "all" || li.type === feeBase)
      .reduce((s, li) => s + Math.round(li.quantity * li.unitCents), 0);
    const feeCents = Math.round(baseCents * (pct / 100));
    setLineItems((prev) => [
      ...prev,
      {
        type: "fee",
        description: `${feeLabel} (${pct}%)`,
        quantity: 1,
        unitCents: feeCents,
      },
    ]);
  }

  const totalCents = lineItems.reduce(
    (s, li) => s + Math.round(li.quantity * li.unitCents),
    0,
  );
  const roundingSummary = preview.roundingSummary;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(lineItems, notes, dueDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-sm">{preview.projectName}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(preview.periodStart)} – {formatDate(preview.periodEnd)}
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums">
          {formatMoney(totalCents)}
        </span>
      </div>

      <InvoiceRoundingSummaryPanel
        roundingSummary={roundingSummary}
        className="mb-4"
      />

      {/* Line items table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left pb-2 font-medium text-gray-500 dark:text-gray-400">
                Description
              </th>
              <th className="text-right pb-2 font-medium text-gray-500 dark:text-gray-400 w-24">
                Qty
              </th>
              <th className="text-right pb-2 font-medium text-gray-500 dark:text-gray-400 w-28">
                Rate
              </th>
              <th className="text-right pb-2 font-medium text-gray-500 dark:text-gray-400 w-28">
                Amount
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-100 dark:border-gray-700/50"
              >
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={li.description}
                    onChange={(e) =>
                      updateItem(idx, "description", e.target.value)
                    }
                    className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 focus:outline-none py-0.5 text-sm"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    step="0.01"
                    value={li.quantity}
                    onChange={(e) =>
                      updateItem(idx, "quantity", e.target.value)
                    }
                    className="w-full text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 focus:outline-none py-0.5 text-sm tabular-nums"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    step="0.01"
                    value={(li.unitCents / 100).toFixed(2)}
                    onChange={(e) =>
                      updateItem(idx, "unitCents", e.target.value)
                    }
                    className="w-full text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 focus:outline-none py-0.5 text-sm tabular-nums"
                  />
                </td>
                <td className="py-2 text-right tabular-nums text-sm">
                  {formatMoney(Math.round(li.quantity * li.unitCents))}
                </td>
                <td className="py-2 pl-2">
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 text-xs leading-none"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                className="pt-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-400 pr-3"
              >
                Total
              </td>
              <td className="pt-3 text-right font-bold tabular-nums">
                {formatMoney(totalCents)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add items toolbar */}
      <div className="flex flex-wrap items-end gap-3 mb-5 pt-1">
        <button
          type="button"
          onClick={addBlankItem}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
        >
          + Add line item
        </button>
        <span className="text-gray-300 dark:text-gray-600 text-xs">|</span>
        {/* % fee tool */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Add fee:
          </span>
          <input
            type="text"
            value={feeLabel}
            onChange={(e) => setFeeLabel(e.target.value)}
            placeholder="Description"
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32"
          />
          <input
            type="number"
            min="0"
            step="0.1"
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-500 w-16"
          />
          <span className="text-xs text-gray-500">% of</span>
          <select
            value={feeBase}
            onChange={(e) =>
              setFeeBase(e.target.value as "all" | "time" | "expense")
            }
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="time">Labour</option>
            <option value="expense">Expenses</option>
            <option value="all">All items</option>
          </select>
          <button
            type="button"
            onClick={addFee}
            className="rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1 font-medium transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes + due date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Net 30"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {lineItems.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
          No line items — add at least one before creating.
        </p>
      )}

      {error && <ErrorAlert message={error} className="mb-4" />}

      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting || lineItems.length === 0}
        >
          {submitting ? "Creating…" : "Create Invoice"}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { authenticated } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // new invoice flow
  const [showNew, setShowNew] = useState(false);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [pendingParams, setPendingParams] = useState<{
    projectId: string;
    periodStart: string;
    periodEnd: string;
  } | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await api<ApiListResponse<InvoiceListItem>>("/invoices");
      setInvoices(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    if (currentUser && !currentUser.isAdmin) {
      router.push("/");
      return;
    }
    Promise.all([
      api<ApiListResponse<ProjectWithClient>>("/projects?status=active"),
      loadInvoices(),
    ]).then(([projRes]) => setProjects(projRes.data));
  }, [authenticated, currentUser, router, loadInvoices]);

  if (!authenticated || !currentUser?.isAdmin) return null;

  async function handlePreview(
    projectId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const res = await api<InvoicePreview>(
      `/invoices/preview?projectId=${projectId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
    );
    setPendingParams({ projectId, periodStart, periodEnd });
    setPreview(res);
  }

  async function handleCreate(
    lineItems: InvoiceLineItemDto[],
    notes: string,
    dueDate: string,
  ) {
    if (!pendingParams) return;
    const res = await api<ApiResponse<InvoiceWithDetails>>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        ...pendingParams,
        lineItems,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
      }),
    });
    setInvoices((prev) => [res.data as unknown as InvoiceListItem, ...prev]);
    setShowNew(false);
    setPreview(null);
    setPendingParams(null);
  }

  function cancelNew() {
    setShowNew(false);
    setPreview(null);
    setPendingParams(null);
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-8">
        <PageHeader
          title="Invoices"
          subtitle="Generate and push invoices to QuickBooks"
        >
          {!showNew && (
            <Button onClick={() => setShowNew(true)}>New Invoice</Button>
          )}
        </PageHeader>

        {showNew && !preview && (
          <NewInvoiceForm
            projects={projects}
            onPreview={handlePreview}
            onCancel={cancelNew}
          />
        )}

        {preview && (
          <InvoicePreviewStep
            preview={preview}
            onSubmit={handleCreate}
            onBack={() => setPreview(null)}
          />
        )}

        {error && <ErrorAlert message={error} className="mb-6" />}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : invoices.length === 0 ? (
          <EmptyState
            message="No invoices yet"
            sub="Create your first invoice to push it to QuickBooks."
          />
        ) : (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                    Project
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                    Period
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                    Total
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">
                    QBO Invoice
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium">
                      <Link
                        href={`/projects/${inv.projectId}`}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        {inv.project.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                      {formatDate(inv.periodStart)} –{" "}
                      {formatDate(inv.periodEnd)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {formatMoney(inv.totalCents)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge color={statusColor(inv.status)}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {inv.qboInvoiceId ? (
                        <div>
                          <span className="block text-sm font-medium tabular-nums">
                            #{inv.qboInvoiceId}
                          </span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            ✓ Synced
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not synced</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
