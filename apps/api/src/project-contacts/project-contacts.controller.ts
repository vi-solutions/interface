import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ProjectContactsService } from "./project-contacts.service";
import type {
  ProjectContactWithDetails,
  CreateProjectContactDto,
  ApiResponse,
  ApiListResponse,
} from "@interface/shared";

@Controller("project-contacts")
export class ProjectContactsController {
  constructor(
    private readonly projectContactsService: ProjectContactsService,
  ) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<ProjectContactWithDetails>> {
    const data = await this.projectContactsService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Post()
  async create(
    @Body() dto: CreateProjectContactDto,
  ): Promise<ApiResponse<ProjectContactWithDetails>> {
    return { data: await this.projectContactsService.create(dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.projectContactsService.remove(id);
  }
}
