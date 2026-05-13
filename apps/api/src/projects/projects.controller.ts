import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
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
} from "@interface/shared";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(
    @Query("userId") userId?: string,
    @Req() req?: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiListResponse<ProjectWithClient>> {
    // Non-admin users always see only their assigned projects
    const effectiveUserId = req?.user?.isAdmin ? userId : req?.user?.sub;
    const data = effectiveUserId
      ? await this.projectsService.findByUser(effectiveUserId)
      : await this.projectsService.findAll();
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

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.projectsService.remove(id);
  }
}
