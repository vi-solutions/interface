import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
} from "@nestjs/common";
import { ProjectNotesService } from "./project-notes.service";
import type {
  ApiResponse,
  ApiListResponse,
  ProjectNoteWithAuthor,
  CreateProjectNoteDto,
  UpdateProjectNoteDto,
} from "@interface/shared";

@Controller("project-notes")
export class ProjectNotesController {
  constructor(private readonly projectNotesService: ProjectNotesService) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<ProjectNoteWithAuthor>> {
    const data = await this.projectNotesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Post()
  async create(
    @Body() dto: CreateProjectNoteDto,
  ): Promise<ApiResponse<ProjectNoteWithAuthor>> {
    return { data: await this.projectNotesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectNoteDto,
    @Request() req: { user: { sub: string } },
  ): Promise<ApiResponse<ProjectNoteWithAuthor>> {
    return {
      data: await this.projectNotesService.update(id, dto, req.user.sub),
    };
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @Request() req: { user: { sub: string; isAdmin: boolean } },
  ): Promise<void> {
    await this.projectNotesService.remove(id, req.user.sub, req.user.isAdmin);
  }
}
