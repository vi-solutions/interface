import { UserExpensesService } from "../src/user-expenses/user-expenses.service";

describe("UserExpensesService expense reports", () => {
  it("filters by the resolved expense category name", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new UserExpensesService(pool as never, {} as never);

    await service.findReport({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      expenseName: "Mileage",
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("COALESCE(pe.name, e.name) = $3");
    expect(params).toEqual(["2026-08-01", "2026-08-31", "Mileage"]);
  });

  it("lists distinct categories used by expense entries", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ name: "Lodging" }, { name: "Meals" }, { name: "Mileage" }],
      }),
    };
    const service = new UserExpensesService(pool as never, {} as never);

    await expect(service.findReportCategories()).resolves.toEqual([
      "Lodging",
      "Meals",
      "Mileage",
    ]);
  });
});
