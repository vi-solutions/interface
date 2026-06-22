import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { TimeEntriesService } from "./time-entries.service";
import { ProjectUserRatesService } from "../project-user-rates/project-user-rates.service";
import type {
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  ApiResponse,
  ApiListResponse,
  TimeEntry,
  TimeEntryWithUser,
  TimeEntryWithDetails,
  TimeEntryReportEntry,
} from "@interface/shared";

@Controller("time-entries")
export class TimeEntriesController {
  constructor(
    private readonly timeEntriesService: TimeEntriesService,
    private readonly projectUserRatesService: ProjectUserRatesService,
  ) {}

  @Get()
  async find(
    @Query("projectId") projectId?: string,
    @Query("userId") userId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("roundUpIncrementHours") roundUpIncrementHours?: string,
    @Req() req?: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiListResponse<TimeEntryWithUser | TimeEntryWithDetails>> {
    if (projectId) {
      const data = await this.timeEntriesService.findByProject(projectId);
      return { data, total: data.length };
    }
    // Non-admin can only see their own entries
    const effectiveUserId = req?.user?.isAdmin ? userId : req?.user?.sub;
    const roundUpIncrement = roundUpIncrementHours
      ? Number(roundUpIncrementHours)
      : undefined;
    const data = await this.timeEntriesService.findRecent({
      startDate,
      endDate,
      userId: effectiveUserId,
      roundUpIncrementHours:
        roundUpIncrement !== undefined && Number.isFinite(roundUpIncrement)
          ? roundUpIncrement
          : undefined,
    });
    return { data, total: data.length };
  }

  @Get("report")
  async report(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("userId") userId: string | undefined,
    @Query("clientId") clientId: string | undefined,
    @Query("projectId") projectId: string | undefined,
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiListResponse<TimeEntryReportEntry>> {
    if (!req.user.isAdmin) throw new ForbiddenException();
    const data = await this.timeEntriesService.findReport({
      startDate,
      endDate,
      userId,
      clientId,
      projectId,
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
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiResponse<TimeEntry>> {
    const effectiveDto: CreateTimeEntryDto = {
      ...dto,
      userId: req.user.isAdmin ? dto.userId : req.user.sub,
    };

    if (!req.user.isAdmin) {
      const assigned =
        await this.projectUserRatesService.isUserAssignedToProject(
          req.user.sub,
          effectiveDto.projectId,
        );
      if (!assigned) {
        throw new ForbiddenException("You are not assigned to this project");
      }
    }
    return {
      data: await this.timeEntriesService.create(effectiveDto),
    };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTimeEntryDto,
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiResponse<TimeEntry>> {
    let effectiveDto = dto;

    if (!req.user.isAdmin) {
      const entry = await this.timeEntriesService.findById(id);
      if (entry.userId !== req.user.sub) throw new ForbiddenException();

      const projectId = dto.projectId ?? entry.projectId;
      if (projectId !== entry.projectId) {
        const assigned =
          await this.projectUserRatesService.isUserAssignedToProject(
            req.user.sub,
            projectId,
          );
        if (!assigned) {
          throw new ForbiddenException("You are not assigned to this project");
        }
      }

      effectiveDto = { ...dto, userId: req.user.sub };
    }
    return {
      data: await this.timeEntriesService.update(id, effectiveDto),
    };
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<void> {
    if (!req.user.isAdmin) {
      const entry = await this.timeEntriesService.findById(id);
      if (entry.userId !== req.user.sub) throw new ForbiddenException();
    }
    await this.timeEntriesService.remove(id);
  }
}
