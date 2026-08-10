import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { ProjectsService } from "./projects.service";
import type {
  CreateProjectDto,
  UpdateProjectDto,
  ApiResponse,
  ApiListResponse,
  Project,
  ProjectWithClient,
  ProjectFinancialSummary,
} from "@interface/shared";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(
    @Query("userId") userId?: string,
    @Query("includeArchived") includeArchived?: string,
    @Req() req?: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiListResponse<ProjectWithClient>> {
    // Non-admin users always see projects they are assigned to or manage.
    const effectiveUserId = req?.user?.isAdmin ? userId : req?.user?.sub;
    const data = effectiveUserId
      ? await this.projectsService.findByUser(effectiveUserId)
      : await this.projectsService.findAll(
          Boolean(req?.user?.isAdmin && includeArchived === "true"),
        );
    return { data, total: data.length };
  }

  @Get("financial-summary")
  async findFinancialSummaries(): Promise<ApiListResponse<ProjectFinancialSummary>> {
    const data = await this.projectsService.findFinancialSummaries();
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
  ): Promise<ApiResponse<ProjectWithClient>> {
    return { data: await this.projectsService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateProjectDto): Promise<ApiResponse<Project>> {
    return { data: await this.projectsService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ApiResponse<Project>> {
    return { data: await this.projectsService.update(id, dto) };
  }

  @Put(":id/archive")
  async archive(
    @Param("id") id: string,
    @Req() req: Request & { user: { isAdmin: boolean } },
  ): Promise<void> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    await this.projectsService.archive(id);
  }

  @Put(":id/restore")
  async restore(
    @Param("id") id: string,
    @Req() req: Request & { user: { isAdmin: boolean } },
  ): Promise<void> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    await this.projectsService.restore(id);
  }
}
