import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  ForbiddenException,
  Query,
} from "@nestjs/common";
import { Request } from "express";
import { ClientsService } from "./clients.service";
import type {
  CreateClientDto,
  UpdateClientDto,
  ApiResponse,
  ApiListResponse,
  Client,
  ClientWithPrimaryContact,
} from "@interface/shared";

@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async findAll(
    @Req()
    req: Request & { user: { sub: string; role: string; isAdmin: boolean } },
    @Query("includeArchived") includeArchived?: string,
  ): Promise<ApiListResponse<ClientWithPrimaryContact>> {
    if (req.user.isAdmin) {
      const data = await this.clientsService.findAll(includeArchived === "true");
      return { data, total: data.length };
    }
    if (req.user.role === "employee") {
      const data = await this.clientsService.findByUser(req.user.sub);
      return { data, total: data.length };
    }
    // contractor: no access to clients list
    return { data: [], total: 0 };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<Client>> {
    return { data: await this.clientsService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateClientDto): Promise<ApiResponse<Client>> {
    return { data: await this.clientsService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ApiResponse<Client>> {
    return { data: await this.clientsService.update(id, dto) };
  }

  @Put(":id/archive")
  async archive(
    @Param("id") id: string,
    @Req() req: Request & { user: { isAdmin: boolean } },
  ): Promise<void> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    await this.clientsService.archive(id);
  }

  @Put(":id/restore")
  async restore(
    @Param("id") id: string,
    @Req() req: Request & { user: { isAdmin: boolean } },
  ): Promise<void> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    await this.clientsService.restore(id);
  }
}
