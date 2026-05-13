import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
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
  ): Promise<ApiListResponse<ClientWithPrimaryContact>> {
    if (req.user.isAdmin) {
      const data = await this.clientsService.findAll();
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

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.clientsService.remove(id);
  }
}
