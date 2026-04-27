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
  TimeEntryWithUser,
  TimeEntryWithDetails,
} from "@interface/shared";

@Controller("time-entries")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  async find(
    @Query("projectId") projectId?: string,
    @Query("userId") userId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<ApiListResponse<TimeEntryWithUser | TimeEntryWithDetails>> {
    if (projectId) {
      const data = await this.timeEntriesService.findByProject(projectId);
      return { data, total: data.length };
    }
    const data = await this.timeEntriesService.findRecent({
      startDate,
      endDate,
      userId,
    });
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
