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
import { ProjectUserRatesService } from "./project-user-rates.service";
import type {
  CreateProjectUserRateDto,
  UpdateProjectUserRateDto,
} from "@interface/shared";

@Controller("project-user-rates")
export class ProjectUserRatesController {
  constructor(
    private readonly projectUserRatesService: ProjectUserRatesService,
  ) {}

  @Get()
  async findByProject(@Query("projectId") projectId: string) {
    const data = await this.projectUserRatesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findById(@Param("id") id: string) {
    return { data: await this.projectUserRatesService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateProjectUserRateDto) {
    return { data: await this.projectUserRatesService.create(dto) };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateProjectUserRateDto) {
    return { data: await this.projectUserRatesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.projectUserRatesService.remove(id);
  }
}
