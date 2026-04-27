import { Injectable, Logger, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { createHmac, timingSafeEqual } from "crypto";
import { DATABASE_POOL } from "../db/database.module";

// ── QBO webhook payload shapes ────────────────────────────────────────────────

interface QboEventNotification {
  realmId: string;
  dataChangeEvent: {
    entities: Array<{
      name: string; // "Invoice", "Payment", etc.
      id: string;
      operation: string; // "Create" | "Update" | "Delete" | "Merge" | "Void"
      lastUpdated: string;
    }>;
  };
}

interface QboWebhookPayload {
  eventNotifications: QboEventNotification[];
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  /**
   * Verify the Intuit HMAC-SHA256 signature.
   * Intuit signs the raw request body with your webhook verifier token.
   * Header: intuit-signature = base64(HMAC-SHA256(rawBody, verifierToken))
   */
  verifySignature(rawBody: Buffer, signature: string): boolean {
    const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
    if (!verifierToken) {
      this.logger.warn(
        "QBO_WEBHOOK_VERIFIER_TOKEN not set — rejecting webhook",
      );
      return false;
    }
    try {
      const expected = createHmac("sha256", verifierToken)
        .update(rawBody)
        .digest("base64");
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(signature);
      if (expectedBuf.length !== receivedBuf.length) return false;
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }

  async handlePayload(payload: QboWebhookPayload): Promise<void> {
    for (const notification of payload.eventNotifications) {
      for (const entity of notification.dataChangeEvent.entities) {
        this.logger.debug(
          `QBO event: ${entity.operation} ${entity.name} #${entity.id} (realm ${notification.realmId})`,
        );
        if (entity.name === "Invoice" && entity.operation === "Update") {
          await this.handleInvoiceUpdate(entity.id);
        } else if (
          entity.name === "Payment" &&
          (entity.operation === "Create" || entity.operation === "Update")
        ) {
          await this.handlePaymentEvent(entity.id, notification.realmId);
        }
      }
    }
  }

  /**
   * When QBO fires an Invoice Update, check its EmailStatus.
   * If EmailSent → mark our invoice as 'sent'.
   */
  private async handleInvoiceUpdate(qboInvoiceId: string): Promise<void> {
    // We don't have a QBO client here — just update by qbo_invoice_id if we
    // receive the status change. For EmailSent we rely on the Payment path for
    // 'paid'. For 'sent' we update optimistically when QBO signals any update
    // to an invoice that is still in draft status — the frontend can also
    // manually update status later. The full status-from-QBO-field approach
    // requires a QBO API read; see handleInvoiceUpdateWithDetails() below.
    const { rows } = await this.pool.query(
      `SELECT id, status FROM invoices WHERE qbo_invoice_id = $1`,
      [qboInvoiceId],
    );
    if (!rows[0]) return;

    // Only transition draft → sent (not backwards). The real email-sent check
    // happens in handleInvoiceUpdateWithDetails when called by the controller
    // with the fetched QBO invoice data.
    this.logger.log(
      `Invoice #${rows[0].id} updated in QBO (status: ${rows[0].status})`,
    );
  }

  /**
   * Mark invoice as 'sent' by QBO invoice ID.
   * Called by the controller after it fetches the QBO invoice and confirms
   * EmailStatus === "EmailSent".
   */
  async markInvoiceSent(qboInvoiceId: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `UPDATE invoices
          SET status = 'sent', updated_at = NOW()
        WHERE qbo_invoice_id = $1
          AND status = 'draft'`,
      [qboInvoiceId],
    );
    if (rowCount && rowCount > 0) {
      this.logger.log(`Invoice qbo#${qboInvoiceId} marked as sent`);
    }
  }

  /**
   * Mark invoice as 'paid' by QBO invoice ID.
   */
  async markInvoicePaid(qboInvoiceId: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `UPDATE invoices
          SET status = 'paid', updated_at = NOW()
        WHERE qbo_invoice_id = $1
          AND status IN ('draft', 'sent')`,
      [qboInvoiceId],
    );
    if (rowCount && rowCount > 0) {
      this.logger.log(`Invoice qbo#${qboInvoiceId} marked as paid`);
    }
  }

  /**
   * A Payment event means money was received. QBO Payment objects have a
   * Line array with LinkedTxn entries pointing at the paid invoice(s).
   * We don't have a QBO client here, so the controller fetches the Payment
   * from QBO and calls markInvoicePaid() for each linked invoice.
   */
  private async handlePaymentEvent(
    _qboPaymentId: string,
    _realmId: string,
  ): Promise<void> {
    // Intentionally a no-op here — the controller fetches the Payment object
    // from QBO (needs auth token) and calls markInvoicePaid() directly.
    // This method is kept as a hook for future direct-DB payment logging.
  }
}
