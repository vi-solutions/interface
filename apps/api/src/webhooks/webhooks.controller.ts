import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../auth/public.decorator";
import { WebhooksService } from "./webhooks.service";
import { QuickbooksService } from "../quickbooks/quickbooks.service";

// QBO invoice shape (partial) returned by the QBO REST API
interface QboInvoice {
  Id: string;
  EmailStatus?: string; // "EmailSent" | "NotSet" | "NeedToSend"
  Balance?: number;
}

// QBO payment shape (partial)
interface QboPayment {
  Id: string;
  Line?: Array<{
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string; // "Invoice"
    }>;
  }>;
}

interface QboWrapped<T> {
  Invoice?: T;
  Payment?: T;
}

@Public()
@Controller("webhooks/quickbooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly qbo: QuickbooksService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("intuit-signature") signature: string,
  ): Promise<void> {
    // 1. Signature verification
    if (!signature) {
      throw new UnauthorizedException("Missing intuit-signature header");
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException("Raw body unavailable");
    }
    if (!this.webhooksService.verifySignature(rawBody, signature)) {
      this.logger.warn("Webhook signature verification failed");
      throw new UnauthorizedException("Invalid webhook signature");
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody.toString("utf8"));
    this.logger.debug(`Webhook received: ${JSON.stringify(payload)}`);

    // 3. Iterate events — for Invoice/Payment we fetch from QBO to get details
    const conn = await this.qbo.getConnection();

    for (const notification of payload.eventNotifications ?? []) {
      for (const entity of notification.dataChangeEvent?.entities ?? []) {
        try {
          if (entity.name === "Invoice" && entity.operation === "Update") {
            await this.handleInvoiceUpdate(entity.id, conn);
          } else if (
            entity.name === "Payment" &&
            (entity.operation === "Create" || entity.operation === "Update")
          ) {
            await this.handlePaymentEvent(entity.id, conn);
          }
        } catch (err) {
          // Log but don't fail the whole webhook — QBO expects 200 back
          this.logger.error(
            `Error processing ${entity.operation} ${entity.name} #${entity.id}: ${err}`,
          );
        }
      }
    }
  }

  private async handleInvoiceUpdate(
    qboInvoiceId: string,
    conn: unknown,
  ): Promise<void> {
    if (!conn) return; // not connected to QBO, skip

    const result = await this.qbo.qboGet<QboWrapped<QboInvoice>>(
      `/invoice/${qboInvoiceId}`,
    );
    const inv = result.Invoice;
    if (!inv) return;

    if (inv.EmailStatus === "EmailSent") {
      await this.webhooksService.markInvoiceSent(qboInvoiceId);
    }
    // If balance is 0 the invoice is fully paid — also mark paid
    if (inv.Balance === 0) {
      await this.webhooksService.markInvoicePaid(qboInvoiceId);
    }
  }

  private async handlePaymentEvent(
    qboPaymentId: string,
    conn: unknown,
  ): Promise<void> {
    if (!conn) return;

    const result = await this.qbo.qboGet<QboWrapped<QboPayment>>(
      `/payment/${qboPaymentId}`,
    );
    const payment = result.Payment;
    if (!payment?.Line) return;

    // Each line's LinkedTxn lists the invoices this payment covers
    for (const line of payment.Line) {
      for (const txn of line.LinkedTxn ?? []) {
        if (txn.TxnType === "Invoice") {
          await this.webhooksService.markInvoicePaid(txn.TxnId);
        }
      }
    }
  }
}
