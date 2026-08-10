import { ForbiddenException } from "@nestjs/common";
import { ClientsController } from "../src/clients/clients.controller";
import { ClientsService } from "../src/clients/clients.service";
import { ProjectsController } from "../src/projects/projects.controller";
import { ProjectsService } from "../src/projects/projects.service";

describe("admin client and project archiving", () => {
  it("rejects client archiving from non-admin users", async () => {
    const archive = jest.fn();
    const controller = new ClientsController({ archive } as never);

    await expect(
      controller.archive("client-1", {
        user: { isAdmin: false },
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(archive).not.toHaveBeenCalled();
  });

  it("rejects project archiving from non-admin users", async () => {
    const archive = jest.fn();
    const controller = new ProjectsController({ archive } as never);

    await expect(
      controller.archive("project-1", {
        user: { isAdmin: false },
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(archive).not.toHaveBeenCalled();
  });

  it("archives projects without deleting their records", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
      }),
    };
    const service = new ProjectsService(pool as never);

    await service.archive("project-1");
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain("status = 'archived'");
  });

  it("archives a client and its projects in one transaction", async () => {
    const dbClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(dbClient) };
    const service = new ClientsService(pool as never);

    await service.archive("client-1");

    expect(dbClient.query.mock.calls[0][0]).toBe("BEGIN");
    expect(dbClient.query.mock.calls[1][0]).toContain("archived_at = NOW()");
    expect(dbClient.query.mock.calls[2][0]).toContain("status = 'archived'");
    expect(dbClient.query.mock.calls[3][0]).toBe("COMMIT");
    expect(dbClient.release).toHaveBeenCalled();
  });

  it("restores a project to its pre-archive status", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    };
    const service = new ProjectsService(pool as never);

    await service.restore("project-1");

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain("COALESCE(p.status_before_archive, 'draft')");
    expect(sql).toContain("c.archived_at IS NULL");
  });

  it("restores a client without automatically restoring projects", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    };
    const service = new ClientsService(pool as never);

    await service.restore("client-1");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain("archived_at = NULL");
  });
});
