export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type InvoiceLineItemType = "time" | "expense";

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  sortOrder: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  qboInvoiceId: string | null;
  notes: string | null;
  dueDate: string | null;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceWithDetails extends Invoice {
  project: { id: string; name: string };
  lineItems: InvoiceLineItem[];
}

export interface InvoiceListItem extends Invoice {
  project: { id: string; name: string };
}

/** Line item shape used in both preview responses and create requests */
export interface InvoiceLineItemDto {
  type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitCents: number;
}

export interface CreateInvoiceDto {
  projectId: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
  dueDate?: string;
  lineItems: InvoiceLineItemDto[];
}

/** Preview response — not persisted */
export interface InvoicePreview {
  projectId: string;
  projectName: string;
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItemDto[];
  totalCents: number;
}
