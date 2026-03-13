import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { ClientsService } from "./clients.service";
import type {
  CreateClientDto,
  UpdateClientDto,
  ApiResponse,
  ApiListResponse,
  Client,
} from "@interface/shared";

@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async findAll(): Promise<ApiListResponse<Client>> {
    const data = await this.clientsService.findAll();
    return { data, total: data.length };
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
