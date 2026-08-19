import { InvoicesService } from "../src/invoices/invoices.service";

describe("InvoicesService.preview", () => {
  it("combines expenses with the same configured category", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ name: "Dawson Henderson Installation" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { expense_name: "Mileage", total_cents: "18750" },
            { expense_name: "Meals", total_cents: "4200" },
          ],
        }),
    };
    const service = new InvoicesService(pool as never, {} as never);

    const preview = await service.preview(
      "project-1",
      "2026-08-01",
      "2026-08-31",
    );

    const expenseSql = pool.query.mock.calls[2][0] as string;
    expect(expenseSql).toContain("SUM(ue.total_cents)");
    expect(expenseSql).toContain("GROUP BY COALESCE(pe.name, e.name)");
    expect(preview.lineItems).toEqual([
      {
        type: "expense",
        description: "Mileage",
        quantity: 1,
        unitCents: 18750,
      },
      {
        type: "expense",
        description: "Meals",
        quantity: 1,
        unitCents: 4200,
      },
    ]);
    expect(preview.totalCents).toBe(22950);
  });
});
