import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { PayPeriodLocksService } from "./pay-period-locks.service";
import type {
  ApiListResponse,
  CreatePayPeriodLockDto,
  PayPeriodLock,
} from "@interface/shared";

@Controller("pay-period-locks")
export class PayPeriodLocksController {
  constructor(private readonly service: PayPeriodLocksService) {}

  @Get()
  async findForPeriod(
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiListResponse<PayPeriodLock>> {
    if (!req.user.isAdmin) throw new ForbiddenException();
    if (!periodStart || !periodEnd) {
      throw new BadRequestException("periodStart and periodEnd are required");
    }
    const data = await this.service.findForPeriod(periodStart, periodEnd);
    return { data, total: data.length };
  }

  @Post()
  async create(
    @Body() dto: CreatePayPeriodLockDto,
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiListResponse<PayPeriodLock>> {
    if (!req.user.isAdmin) throw new ForbiddenException();
    if (!dto.periodStart || !dto.periodEnd) {
      throw new BadRequestException("periodStart and periodEnd are required");
    }
    const data = await this.service.createForPeriod(
      dto.periodStart,
      dto.periodEnd,
      req.user.sub,
    );
    return { data, total: data.length };
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @Req() req: Request & { user: { sub: string; isAdmin: boolean } },
  ): Promise<void> {
    if (!req.user.isAdmin) throw new ForbiddenException();
    await this.service.remove(id);
  }
}
