import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../db/database.module";
import type { QboConnection, QboCustomer } from "@interface/shared";

const QBO_AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function apiBase(): string {
  return process.env.QBO_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

@Injectable()
export class QuickbooksService {
  private readonly logger = new Logger(QuickbooksService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  /* ------------------------------------------------------------------ */
  /*  OAuth helpers                                                      */
  /* ------------------------------------------------------------------ */

  /** Build the Intuit OAuth2 authorization URL */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.QBO_CLIENT_ID!,
      redirect_uri: process.env.QBO_REDIRECT_URI!,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      state,
    });
    return `${QBO_AUTH_BASE}?${params}`;
  }

  /** Exchange the authorization code for tokens and persist them */
  async exchangeCode(code: string, realmId: string): Promise<QboConnection> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI!,
    });

    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64")}`,
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Token exchange failed: ${err}`);
      throw new BadRequestException("Failed to connect to QuickBooks");
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
    };

    return this.upsertConnection(realmId, tokens);
  }

  /** Refresh the access token using the stored refresh token */
  private async refreshAccessToken(conn: {
    refresh_token: string;
    realm_id: string;
  }): Promise<QboConnection> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    });

    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64")}`,
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Token refresh failed: ${err}`);
      throw new BadRequestException(
        "QuickBooks token refresh failed — please reconnect",
      );
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
    };

    return this.upsertConnection(conn.realm_id, tokens);
  }

  /** Upsert the single-row qbo_connection record */
  private async upsertConnection(
    realmId: string,
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
    },
  ): Promise<QboConnection> {
    const accessExpires = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();
    const refreshExpires = new Date(
      Date.now() + tokens.x_refresh_token_expires_in * 1000,
    ).toISOString();

    // Delete any existing rows then insert (single-company model)
    await this.pool.query("DELETE FROM qbo_connection");
    const { rows } = await this.pool.query(
      `INSERT INTO qbo_connection
         (realm_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, realm_id AS "realmId",
                 access_token_expires_at AS "accessTokenExpiresAt",
                 refresh_token_expires_at AS "refreshTokenExpiresAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        realmId,
        tokens.access_token,
        tokens.refresh_token,
        accessExpires,
        refreshExpires,
      ],
    );
    return rows[0];
  }

  /* ------------------------------------------------------------------ */
  /*  Connection status                                                  */
  /* ------------------------------------------------------------------ */

  async getConnection(): Promise<QboConnection | null> {
    const { rows } = await this.pool.query(
      `SELECT id, realm_id AS "realmId",
              access_token_expires_at AS "accessTokenExpiresAt",
              refresh_token_expires_at AS "refreshTokenExpiresAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM qbo_connection LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async disconnect(): Promise<void> {
    await this.pool.query("DELETE FROM qbo_connection");
  }

  /* ------------------------------------------------------------------ */
  /*  Authenticated QBO API calls                                        */
  /* ------------------------------------------------------------------ */

  /** Get a valid access token, refreshing if needed */
  private async getAccessToken(): Promise<{ token: string; realmId: string }> {
    const { rows } = await this.pool.query(
      `SELECT realm_id, access_token, refresh_token, access_token_expires_at
       FROM qbo_connection LIMIT 1`,
    );
    if (!rows[0]) {
      throw new BadRequestException("QuickBooks is not connected");
    }

    const row = rows[0];
    const expiresAt = new Date(row.access_token_expires_at).getTime();

    // Refresh if token expires within 5 minutes
    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      const refreshed = await this.refreshAccessToken(row);
      // Re-read the fresh token
      const { rows: fresh } = await this.pool.query(
        "SELECT access_token, realm_id FROM qbo_connection LIMIT 1",
      );
      return { token: fresh[0].access_token, realmId: fresh[0].realm_id };
    }

    return { token: row.access_token, realmId: row.realm_id };
  }

  /** Make an authenticated GET request to the QBO API */
  async qboGet<T>(path: string): Promise<T> {
    const { token, realmId } = await this.getAccessToken();
    const url = `${apiBase()}/v3/company/${realmId}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`QBO GET ${path} failed: ${err}`);
      throw new BadRequestException("QuickBooks API request failed");
    }
    return res.json() as T;
  }

  /** Make an authenticated POST request to the QBO API */
  async qboPost<T>(path: string, body: unknown): Promise<T> {
    const { token, realmId } = await this.getAccessToken();
    const url = `${apiBase()}/v3/company/${realmId}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`QBO POST ${path} failed: ${err}`);
      throw new BadRequestException("QuickBooks API request failed");
    }
    return res.json() as T;
  }

  /* ------------------------------------------------------------------ */
  /*  QBO Customer helpers                                               */
  /* ------------------------------------------------------------------ */

  /** Search QBO customers by name */
  async searchCustomers(search?: string): Promise<QboCustomer[]> {
    const query = search
      ? `SELECT * FROM Customer WHERE DisplayName LIKE '%${search.replace(/'/g, "\\'")}%' MAXRESULTS 50`
      : "SELECT * FROM Customer MAXRESULTS 50";

    const result = await this.qboGet<{
      QueryResponse: { Customer?: Array<{ Id: string; DisplayName: string }> };
    }>(`/query?query=${encodeURIComponent(query)}`);

    return (result.QueryResponse.Customer ?? []).map((c) => ({
      id: c.Id,
      displayName: c.DisplayName,
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  QBO Vendor helpers (for TimeActivity)                              */
  /* ------------------------------------------------------------------ */

  /** Cache vendor ID by display name so we only look up / create once */
  private vendorCache = new Map<string, string>();

  /** Find or create a QBO Vendor by display name, returns Vendor ID */
  private async getOrCreateVendor(displayName: string): Promise<string> {
    const cached = this.vendorCache.get(displayName);
    if (cached) return cached;

    // Search for existing vendor
    const escapedName = displayName.replace(/'/g, "\\'");
    const searchResult = await this.qboGet<{
      QueryResponse: { Vendor?: Array<{ Id: string; DisplayName: string }> };
    }>(
      `/query?query=${encodeURIComponent(`SELECT Id, DisplayName FROM Vendor WHERE DisplayName = '${escapedName}'`)}`,
    );

    const existing = searchResult.QueryResponse.Vendor?.[0];
    if (existing) {
      this.vendorCache.set(displayName, existing.Id);
      return existing.Id;
    }

    // Create new vendor
    const created = await this.qboPost<{
      Vendor: { Id: string };
    }>("/vendor", { DisplayName: displayName });

    this.vendorCache.set(displayName, created.Vendor.Id);
    return created.Vendor.Id;
  }

  /* ------------------------------------------------------------------ */
  /*  QBO TimeActivity                                                   */
  /* ------------------------------------------------------------------ */

  async createTimeActivity(params: {
    customerRef: string;
    hours: number;
    minutes: number;
    date: string;
    description: string;
    employeeName: string;
    billable?: boolean;
  }): Promise<string> {
    const vendorId = await this.getOrCreateVendor(params.employeeName);

    const body: Record<string, unknown> = {
      NameOf: "Vendor",
      VendorRef: { value: vendorId },
      TxnDate: params.date,
      Hours: params.hours,
      Minutes: params.minutes,
      Description: params.description,
      CustomerRef: { value: params.customerRef },
      BillableStatus: params.billable !== false ? "Billable" : "NotBillable",
    };

    const result = await this.qboPost<{
      TimeActivity: { Id: string };
    }>("/timeactivity", body);
    return result.TimeActivity.Id;
  }

  async updateTimeActivity(
    qboId: string,
    params: {
      customerRef: string;
      hours: number;
      minutes: number;
      date: string;
      description: string;
      employeeName?: string;
      billable?: boolean;
    },
  ): Promise<void> {
    const existing = await this.qboGet<{
      TimeActivity: { SyncToken: string; VendorRef?: { value: string } };
    }>(`/timeactivity/${qboId}`);

    // Reuse existing vendor ref, or resolve a new one if employee name changed
    const vendorId = params.employeeName
      ? await this.getOrCreateVendor(params.employeeName)
      : existing.TimeActivity.VendorRef?.value;

    await this.qboPost("/timeactivity", {
      Id: qboId,
      SyncToken: existing.TimeActivity.SyncToken,
      NameOf: "Vendor",
      VendorRef: vendorId ? { value: vendorId } : undefined,
      TxnDate: params.date,
      Hours: params.hours,
      Minutes: params.minutes,
      Description: params.description,
      CustomerRef: { value: params.customerRef },
      BillableStatus: params.billable !== false ? "Billable" : "NotBillable",
    });
  }

  async deleteTimeActivity(qboId: string): Promise<void> {
    const existing = await this.qboGet<{
      TimeActivity: { Id: string; SyncToken: string };
    }>(`/timeactivity/${qboId}`);

    await this.qboPost("/timeactivity?operation=delete", {
      Id: qboId,
      SyncToken: existing.TimeActivity.SyncToken,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  QBO Purchase (expense)                                             */
  /* ------------------------------------------------------------------ */

  /** Cache the default expense account ID so we only query once per process */
  private expenseAccountId: string | null = null;

  /** Find an Expense-type account in QBO to use for purchases */
  private async getExpenseAccountRef(): Promise<string> {
    if (this.expenseAccountId) return this.expenseAccountId;

    const result = await this.qboGet<{
      QueryResponse: {
        Account?: Array<{ Id: string; Name: string; AccountType: string }>;
      };
    }>(
      `/query?query=${encodeURIComponent("SELECT Id, Name, AccountType FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1")}`,
    );

    const account = result.QueryResponse.Account?.[0];
    if (!account) {
      throw new BadRequestException(
        "No Expense account found in QuickBooks. Please create one first.",
      );
    }

    this.expenseAccountId = account.Id;
    return account.Id;
  }

  async createExpense(params: {
    customerRef: string;
    totalDollars: number;
    date: string;
    description: string;
  }): Promise<string> {
    const accountRef = await this.getExpenseAccountRef();
    const body: Record<string, unknown> = {
      PaymentType: "Cash",
      TxnDate: params.date,
      Line: [
        {
          Amount: params.totalDollars,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            CustomerRef: { value: params.customerRef },
            BillableStatus: "Billable",
            AccountRef: { value: accountRef },
          },
          Description: params.description,
        },
      ],
    };

    const result = await this.qboPost<{
      Purchase: { Id: string };
    }>("/purchase", body);
    return result.Purchase.Id;
  }

  async updateExpense(
    qboId: string,
    params: {
      customerRef: string;
      totalDollars: number;
      date: string;
      description: string;
    },
  ): Promise<void> {
    const accountRef = await this.getExpenseAccountRef();
    const existing = await this.qboGet<{
      Purchase: { SyncToken: string; Line: unknown[] };
    }>(`/purchase/${qboId}`);

    await this.qboPost("/purchase", {
      Id: qboId,
      SyncToken: existing.Purchase.SyncToken,
      PaymentType: "Cash",
      TxnDate: params.date,
      Line: [
        {
          Amount: params.totalDollars,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            CustomerRef: { value: params.customerRef },
            BillableStatus: "Billable",
            AccountRef: { value: accountRef },
          },
          Description: params.description,
        },
      ],
    });
  }

  async deleteExpense(qboId: string): Promise<void> {
    const existing = await this.qboGet<{
      Purchase: { Id: string; SyncToken: string };
    }>(`/purchase/${qboId}`);

    await this.qboPost("/purchase?operation=delete", {
      Id: qboId,
      SyncToken: existing.Purchase.SyncToken,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  QBO Invoice                                                        */
  /* ------------------------------------------------------------------ */

  /** Cache for income account and service item IDs */
  private incomeAccountId: string | null = null;
  private serviceItemId: string | null = null;

  private async getIncomeAccountRef(): Promise<string> {
    if (this.incomeAccountId) return this.incomeAccountId;
    const result = await this.qboGet<{
      QueryResponse: { Account?: Array<{ Id: string }> };
    }>(
      `/query?query=${encodeURIComponent("SELECT Id FROM Account WHERE AccountType = 'Income' MAXRESULTS 1")}`,
    );
    const account = result.QueryResponse.Account?.[0];
    if (!account) {
      throw new BadRequestException(
        "No Income account found in QuickBooks. Please create one first.",
      );
    }
    this.incomeAccountId = account.Id;
    return account.Id;
  }

  /** Find or create a "Services" item to use as the line item product/service ref */
  private async getServiceItemRef(): Promise<string> {
    if (this.serviceItemId) return this.serviceItemId;

    const searchResult = await this.qboGet<{
      QueryResponse: { Item?: Array<{ Id: string }> };
    }>(
      `/query?query=${encodeURIComponent("SELECT Id FROM Item WHERE Name = 'Services' MAXRESULTS 1")}`,
    );

    const existing = searchResult.QueryResponse.Item?.[0];
    if (existing) {
      this.serviceItemId = existing.Id;
      return existing.Id;
    }

    const incomeAccountId = await this.getIncomeAccountRef();
    const created = await this.qboPost<{ Item: { Id: string } }>("/item", {
      Name: "Services",
      Type: "Service",
      IncomeAccountRef: { value: incomeAccountId },
    });
    this.serviceItemId = created.Item.Id;
    return created.Item.Id;
  }

  /** Look up the active HST/GST tax code ID for Canadian QBO accounts */
  private taxCodeId: string | null = null;
  private async getTaxCodeRef(): Promise<string> {
    if (this.taxCodeId) return this.taxCodeId;

    const result = await this.qboGet<{
      QueryResponse: { TaxCode?: Array<{ Id: string; Name: string }> };
    }>(
      `/query?query=${encodeURIComponent("SELECT Id, Name FROM TaxCode WHERE Active = true MAXRESULTS 30")}`,
    );
    const codes = result.QueryResponse.TaxCode ?? [];
    this.logger.debug(
      `Available tax codes: ${codes.map((c) => `${c.Id}:${c.Name}`).join(", ")}`,
    );
    // Prefer a provincial HST rate, then GST, then anything non-exempt
    const preferred =
      codes.find((c) => /^hst/i.test(c.Name)) ??
      codes.find((c) => /hst/i.test(c.Name)) ??
      codes.find((c) => /^gst/i.test(c.Name)) ??
      codes.find((c) => !/exempt|zero|out of scope|non/i.test(c.Name));
    if (!preferred) {
      throw new BadRequestException(
        "No active GST/HST tax code found in QuickBooks.",
      );
    }
    this.logger.log(`Using QBO tax code: ${preferred.Id} (${preferred.Name})`);
    this.taxCodeId = preferred.Id;
    return preferred.Id;
  }

  async createInvoice(params: {
    customerRef: string;
    txnDate: string;
    dueDate?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitCents: number;
    }>;
    memo?: string;
  }): Promise<string> {
    const itemRef = await this.getServiceItemRef();
    const taxCode = await this.getTaxCodeRef();

    const lines = params.lineItems.map((li) => ({
      Amount: (li.unitCents * li.quantity) / 100,
      DetailType: "SalesItemLineDetail",
      Description: li.description,
      SalesItemLineDetail: {
        ItemRef: { value: itemRef },
        Qty: li.quantity,
        UnitPrice: li.unitCents / 100,
        TaxCodeRef: { value: taxCode },
      },
    }));

    const body: Record<string, unknown> = {
      CustomerRef: { value: params.customerRef },
      TxnDate: params.txnDate,
      // TaxExcluded: line amounts are pre-tax; QBO calculates and appends tax
      GlobalTaxCalculation: "TaxExcluded",
      Line: lines,
    };
    if (params.dueDate) body.DueDate = params.dueDate;
    if (params.memo) body.CustomerMemo = { value: params.memo };

    const result = await this.qboPost<{ Invoice: { Id: string } }>(
      "/invoice",
      body,
    );
    return result.Invoice.Id;
  }

  async deleteInvoice(qboId: string): Promise<void> {
    const existing = await this.qboGet<{
      Invoice: { Id: string; SyncToken: string };
    }>(`/invoice/${qboId}`);

    await this.qboPost("/invoice?operation=void", {
      Id: qboId,
      SyncToken: existing.Invoice.SyncToken,
    });
  }
}
