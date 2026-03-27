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
import { ContactsService } from "./contacts.service";
import type {
  Contact,
  CreateContactDto,
  UpdateContactDto,
  ApiResponse,
  ApiListResponse,
} from "@interface/shared";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async findAll(
    @Query("clientId") clientId?: string,
  ): Promise<ApiListResponse<Contact>> {
    const data = clientId
      ? await this.contactsService.findByClient(clientId)
      : await this.contactsService.findAll();
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<Contact>> {
    return { data: await this.contactsService.findById(id) };
  }

  @Post()
  async create(@Body() dto: CreateContactDto): Promise<ApiResponse<Contact>> {
    return { data: await this.contactsService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<ApiResponse<Contact>> {
    return { data: await this.contactsService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.contactsService.remove(id);
  }
}
