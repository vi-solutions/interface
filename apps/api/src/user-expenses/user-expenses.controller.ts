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
import { UserExpensesService } from "./user-expenses.service";
import type {
  ApiResponse,
  ApiListResponse,
  UserExpense,
  UserExpenseWithDetails,
  CreateUserExpenseDto,
  UpdateUserExpenseDto,
} from "@interface/shared";

@Controller("user-expenses")
export class UserExpensesController {
  constructor(private readonly userExpensesService: UserExpensesService) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<UserExpenseWithDetails>> {
    const data = await this.userExpensesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<UserExpense>> {
    return { data: await this.userExpensesService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateUserExpenseDto,
  ): Promise<ApiResponse<UserExpense>> {
    return { data: await this.userExpensesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserExpenseDto,
  ): Promise<ApiResponse<UserExpense>> {
    return { data: await this.userExpensesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.userExpensesService.remove(id);
  }
}
