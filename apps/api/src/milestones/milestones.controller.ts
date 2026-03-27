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
import { MilestonesService } from "./milestones.service";
import type {
  ApiResponse,
  ApiListResponse,
  Milestone,
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from "@interface/shared";

@Controller("milestones")
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId: string,
  ): Promise<ApiListResponse<Milestone>> {
    const data = await this.milestonesService.findByProject(projectId);
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<Milestone>> {
    return { data: await this.milestonesService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateMilestoneDto,
  ): Promise<ApiResponse<Milestone>> {
    return { data: await this.milestonesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateMilestoneDto,
  ): Promise<ApiResponse<Milestone>> {
    return { data: await this.milestonesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.milestonesService.remove(id);
  }
}
