import { ProjectsService } from "../src/projects/projects.service";

describe("ProjectsService.findByUser", () => {
  it("queries projects where user is assigned or project manager", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new ProjectsService(pool as never);

    await service.findByUser("user-1");

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("p.project_manager_id = $1");
    expect(sql).toContain("project_user_rates");
    expect(params).toEqual(["user-1"]);
  });
});
