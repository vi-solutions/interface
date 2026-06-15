import { ProjectUserRatesService } from "../src/project-user-rates/project-user-rates.service";

describe("ProjectUserRatesService.isUserAssignedToProject", () => {
  it("allows access when user is project manager", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    };
    const service = new ProjectUserRatesService(pool as never);

    const result = await service.isUserAssignedToProject("user-1", "project-1");

    expect(result).toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("p.project_manager_id = $1");
    expect(sql).toContain("EXISTS");
    expect(params).toEqual(["user-1", "project-1"]);
  });

  it("denies access when user is neither PM nor assigned", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new ProjectUserRatesService(pool as never);

    const result = await service.isUserAssignedToProject("user-2", "project-2");

    expect(result).toBe(false);
  });
});
