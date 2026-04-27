import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import type { CreateInvoiceDto } from "@interface/shared";

@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get("preview")
  preview(
    @Query("projectId") projectId: string,
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
  ) {
    return this.invoicesService.preview(projectId, periodStart, periodEnd);
  }

  @Get()
  findAll() {
    return this.invoicesService.findAll().then((data) => ({ data }));
  }

  @Get(":id")
  findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoicesService.findById(id).then((data) => ({ data }));
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto).then((data) => ({ data }));
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoicesService.remove(id).then(() => ({ data: null }));
  }
}
