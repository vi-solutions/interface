import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import type {
  ApiResponse,
  ApiListResponse,
  Expense,
  CreateExpenseDto,
  UpdateExpenseDto,
} from "@interface/shared";

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async findAll(): Promise<ApiListResponse<Expense>> {
    const data = await this.expensesService.findAll();
    return { data, total: data.length };
  }

  @Get("archived")
  async findArchived(): Promise<ApiListResponse<Expense>> {
    const data = await this.expensesService.findArchived();
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<Expense>> {
    return { data: await this.expensesService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateExpenseDto): Promise<ApiResponse<Expense>> {
    return { data: await this.expensesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ApiResponse<Expense>> {
    return { data: await this.expensesService.update(id, dto) };
  }

  @Delete(":id")
  async archive(@Param("id") id: string): Promise<void> {
    await this.expensesService.archive(id);
  }

  @Post(":id/unarchive")
  async unarchive(@Param("id") id: string): Promise<void> {
    await this.expensesService.unarchive(id);
  }
}
