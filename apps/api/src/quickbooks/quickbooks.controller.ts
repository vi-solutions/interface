import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Res,
  Param,
  Body,
} from "@nestjs/common";
import type { Response } from "express";
import { QuickbooksService } from "./quickbooks.service";
import { ClientsService } from "../clients/clients.service";
import { Public } from "../auth/public.decorator";
import type {
  ApiResponse,
  QboConnection,
  QboCustomer,
  Client,
} from "@interface/shared";

@Controller("quickbooks")
export class QuickbooksController {
  constructor(
    private readonly qbo: QuickbooksService,
    private readonly clientsService: ClientsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  OAuth flow                                                         */
  /* ------------------------------------------------------------------ */

  /** Redirect the user to Intuit's OAuth consent screen */
  @Public()
  @Get("connect")
  connect(@Res() res: Response): void {
    const state = crypto.randomUUID();
    const url = this.qbo.getAuthorizationUrl(state);
    res.redirect(url);
  }

  /** Intuit redirects back here with ?code=...&realmId=... */
  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("realmId") realmId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.qbo.exchangeCode(code, realmId);
    // Redirect to the frontend settings page
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    res.redirect(`${webUrl}/admin/integrations?qbo=connected`);
  }

  /* ------------------------------------------------------------------ */
  /*  Connection status                                                  */
  /* ------------------------------------------------------------------ */

  @Get("status")
  async status(): Promise<ApiResponse<QboConnection | null>> {
    return { data: await this.qbo.getConnection() };
  }

  @Delete("disconnect")
  async disconnect(): Promise<void> {
    await this.qbo.disconnect();
  }

  /* ------------------------------------------------------------------ */
  /*  QBO Customer search (for client linking)                           */
  /* ------------------------------------------------------------------ */

  @Get("customers")
  async searchCustomers(
    @Query("search") search?: string,
  ): Promise<{ data: QboCustomer[] }> {
    const data = await this.qbo.searchCustomers(search);
    return { data };
  }

  /* ------------------------------------------------------------------ */
  /*  Link / unlink a local client to a QBO Customer                     */
  /* ------------------------------------------------------------------ */

  @Post("clients/:clientId/link")
  async linkClient(
    @Param("clientId") clientId: string,
    @Body() body: { qboCustomerId: string },
  ): Promise<ApiResponse<Client>> {
    const data = await this.clientsService.linkQboCustomer(
      clientId,
      body.qboCustomerId,
    );
    return { data };
  }

  @Delete("clients/:clientId/link")
  async unlinkClient(
    @Param("clientId") clientId: string,
  ): Promise<ApiResponse<Client>> {
    const data = await this.clientsService.linkQboCustomer(clientId, null);
    return { data };
  }

  /* ------------------------------------------------------------------ */
  /*  Debug: query TimeActivities                                        */
  /* ------------------------------------------------------------------ */

  @Get("debug/time-activities")
  async debugTimeActivities(): Promise<unknown> {
    return this.qbo.qboGet(
      `/query?query=${encodeURIComponent("SELECT * FROM TimeActivity MAXRESULTS 10")}`,
    );
  }
}
