import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { HarvestService } from "./harvest.service";

@Controller("harvest")
export class HarvestController {
  constructor(private readonly harvestService: HarvestService) {}

  private requireAdmin(req: Request & { user: { isAdmin: boolean } }) {
    if (!req.user.isAdmin) throw new ForbiddenException();
  }

  @Get("status")
  async getStatus(@Req() req: Request & { user: { isAdmin: boolean } }) {
    this.requireAdmin(req);
    return this.harvestService.getStatus();
  }

  @Get("mappings")
  async getMappings(@Req() req: Request & { user: { isAdmin: boolean } }) {
    this.requireAdmin(req);
    return this.harvestService.getMappings();
  }

  @Post("mappings")
  async upsertMapping(
    @Req() req: Request & { user: { isAdmin: boolean } },
    @Body()
    body: {
      harvestProjectId: string;
      harvestProjectName: string;
      appProjectId: string;
    },
  ) {
    this.requireAdmin(req);
    await this.harvestService.upsertMapping(
      body.harvestProjectId,
      body.harvestProjectName,
      body.appProjectId,
    );
    return { ok: true };
  }

  @Delete("mappings/:harvestProjectId")
  async deleteMapping(
    @Req() req: Request & { user: { isAdmin: boolean } },
    @Param("harvestProjectId") harvestProjectId: string,
  ) {
    this.requireAdmin(req);
    await this.harvestService.deleteMapping(harvestProjectId);
    return { ok: true };
  }

  @Get("harvest-projects")
  async getHarvestProjects(
    @Req() req: Request & { user: { isAdmin: boolean } },
  ) {
    this.requireAdmin(req);
    return this.harvestService.getHarvestProjects();
  }

  @Get("preview")
  async preview(
    @Query("from") from: string,
    @Query("to") to: string,
    @Req() req: Request & { user: { isAdmin: boolean } },
  ) {
    this.requireAdmin(req);
    const today = new Date().toISOString().slice(0, 10);
    return this.harvestService.preview(from ?? "2000-01-01", to ?? today);
  }

  @Post("import")
  async runImport(
    @Query("from") from: string,
    @Query("to") to: string,
    @Req() req: Request & { user: { isAdmin: boolean } },
  ) {
    this.requireAdmin(req);
    const today = new Date().toISOString().slice(0, 10);
    return this.harvestService.runImport(from ?? "2000-01-01", to ?? today);
  }
}
