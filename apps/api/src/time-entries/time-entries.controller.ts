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
import { TimeEntriesService } from "./time-entries.service";
import type {
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  ApiResponse,
  ApiListResponse,
  TimeEntry,
} from "@interface/shared";

@Controller("time-entries")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<TimeEntry>> {
    const data = await this.timeEntriesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<TimeEntry>> {
    return { data: await this.timeEntriesService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateTimeEntryDto,
  ): Promise<ApiResponse<TimeEntry>> {
    return { data: await this.timeEntriesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTimeEntryDto,
  ): Promise<ApiResponse<TimeEntry>> {
    return { data: await this.timeEntriesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.timeEntriesService.remove(id);
  }
}
