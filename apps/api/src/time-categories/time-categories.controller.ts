import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { TimeCategoriesService } from "./time-categories.service";
import type {
  TimeCategory,
  CreateTimeCategoryDto,
  UpdateTimeCategoryDto,
  ApiResponse,
  ApiListResponse,
} from "@interface/shared";

@Controller("time-categories")
export class TimeCategoriesController {
  constructor(private readonly timeCategoriesService: TimeCategoriesService) {}

  @Get()
  async findAll(): Promise<ApiListResponse<TimeCategory>> {
    const data = await this.timeCategoriesService.findAll();
    return { data, total: data.length };
  }

  @Get("archived")
  async findArchived(): Promise<ApiListResponse<TimeCategory>> {
    const data = await this.timeCategoriesService.findArchived();
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<TimeCategory>> {
    return { data: await this.timeCategoriesService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateTimeCategoryDto,
  ): Promise<ApiResponse<TimeCategory>> {
    return { data: await this.timeCategoriesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTimeCategoryDto,
  ): Promise<ApiResponse<TimeCategory>> {
    return { data: await this.timeCategoriesService.update(id, dto) };
  }

  @Delete(":id")
  async archive(@Param("id") id: string): Promise<void> {
    await this.timeCategoriesService.archive(id);
  }

  @Post(":id/unarchive")
  async unarchive(@Param("id") id: string): Promise<void> {
    await this.timeCategoriesService.unarchive(id);
  }
}
