import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
} from "@nestjs/common";
import { ProjectExpensesService } from "./project-expenses.service";
import type {
  ApiResponse,
  ApiListResponse,
  ProjectExpense,
  CreateProjectExpenseDto,
  UpdateProjectExpenseDto,
} from "@interface/shared";

@Controller("project-expenses")
export class ProjectExpensesController {
  constructor(
    private readonly projectExpensesService: ProjectExpensesService,
  ) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<ProjectExpense>> {
    const data = await this.projectExpensesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<ProjectExpense>> {
    return { data: await this.projectExpensesService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateProjectExpenseDto,
  ): Promise<ApiResponse<ProjectExpense>> {
    return { data: await this.projectExpensesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectExpenseDto,
  ): Promise<ApiResponse<ProjectExpense>> {
    return { data: await this.projectExpensesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.projectExpensesService.remove(id);
  }
}
