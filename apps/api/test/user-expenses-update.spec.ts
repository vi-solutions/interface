import { BadRequestException } from "@nestjs/common";
import { UserExpensesService } from "../src/user-expenses/user-expenses.service";

const existingExpense = {
  id: "expense-entry-1",
  projectId: "project-1",
  userId: "user-1",
  projectExpenseId: "airfare",
  date: "2026-08-01",
  quantity: null,
  totalCents: 12500,
  notes: null,
  receiptUrl: null,
  qboExpenseId: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("UserExpensesService category updates", () => {
  it("reassigns an expense to another category on the same project", async () => {
    const updated = { ...existingExpense, projectExpenseId: "meals" };
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [existingExpense] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ type: "dollar", rateCents: 0 }] })
        .mockResolvedValueOnce({ rows: [updated] }),
    };
    const qboSync = { syncExpenseUpdate: jest.fn() };
    const service = new UserExpensesService(pool as never, qboSync as never);

    await expect(
      service.update(existingExpense.id, {
        projectExpenseId: "meals",
        totalCents: 12500,
      }),
    ).resolves.toEqual(updated);

    const [sql, params] = pool.query.mock.calls[3];
    expect(sql).toContain("project_expense_id = $2");
    expect(params).toEqual([
      existingExpense.id,
      "meals",
      existingExpense.date,
      null,
      12500,
      null,
    ]);
    expect(qboSync.syncExpenseUpdate).toHaveBeenCalledWith(existingExpense.id);
  });

  it("recalculates rate-based expenses using the selected category rate", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [existingExpense] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ type: "per_km", rateCents: 70 }],
        })
        .mockResolvedValueOnce({ rows: [{ ...existingExpense }] }),
    };
    const service = new UserExpensesService(pool as never, {
      syncExpenseUpdate: jest.fn(),
    } as never);

    await service.update(existingExpense.id, {
      projectExpenseId: "mileage",
      quantity: 12.5,
      totalCents: 1,
    });

    expect(pool.query.mock.calls[3][1][3]).toBe(12.5);
    expect(pool.query.mock.calls[3][1][4]).toBe(875);
  });

  it("rejects a category that does not belong to the entry's project", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [existingExpense] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new UserExpensesService(pool as never, {} as never);

    await expect(
      service.update(existingExpense.id, { projectExpenseId: "other-project" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
