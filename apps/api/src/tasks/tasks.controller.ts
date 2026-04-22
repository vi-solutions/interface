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
import { TasksService } from "./tasks.service";
import type {
  Task,
  TaskUserBudget,
  TaskUserBudgetWithUser,
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskUserBudgetDto,
  UpdateTaskUserBudgetDto,
  ApiResponse,
  ApiListResponse,
} from "@interface/shared";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<Task>> {
    const data = await this.tasksService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<Task>> {
    return { data: await this.tasksService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateTaskDto): Promise<ApiResponse<Task>> {
    return { data: await this.tasksService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<ApiResponse<Task>> {
    return { data: await this.tasksService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.tasksService.remove(id);
  }

  // ── Per-employee budgets ────────────────────────────────────────────────

  @Get(":id/user-budgets")
  async findUserBudgets(
    @Param("id") id: string,
  ): Promise<ApiListResponse<TaskUserBudgetWithUser>> {
    const data = await this.tasksService.findUserBudgetsByTask(id);
    return { data, total: data.length };
  }

  @Post(":id/user-budgets")
  async createUserBudget(
    @Param("id") taskId: string,
    @Body() dto: CreateTaskUserBudgetDto,
  ): Promise<ApiResponse<TaskUserBudget>> {
    return {
      data: await this.tasksService.createUserBudget({ ...dto, taskId }),
    };
  }

  @Put("user-budgets/:budgetId")
  async updateUserBudget(
    @Param("budgetId") budgetId: string,
    @Body() dto: UpdateTaskUserBudgetDto,
  ): Promise<ApiResponse<TaskUserBudget>> {
    return { data: await this.tasksService.updateUserBudget(budgetId, dto) };
  }

  @Delete("user-budgets/:budgetId")
  async removeUserBudget(@Param("budgetId") budgetId: string): Promise<void> {
    await this.tasksService.removeUserBudget(budgetId);
  }
}
