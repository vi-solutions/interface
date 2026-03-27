import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ProjectTimeCategoriesService } from "./project-time-categories.service";
import type {
  CreateProjectTimeCategoryDto,
  UpdateProjectTimeCategoryDto,
} from "@interface/shared";

@Controller("project-time-categories")
export class ProjectTimeCategoriesController {
  constructor(
    private readonly projectTimeCategoriesService: ProjectTimeCategoriesService,
  ) {}

  @Get()
  async findByProject(@Query("projectId") projectId: string) {
    const data =
      await this.projectTimeCategoriesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findById(@Param("id") id: string) {
    return { data: await this.projectTimeCategoriesService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateProjectTimeCategoryDto) {
    return { data: await this.projectTimeCategoriesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectTimeCategoryDto,
  ) {
    return { data: await this.projectTimeCategoriesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.projectTimeCategoriesService.remove(id);
  }
}
