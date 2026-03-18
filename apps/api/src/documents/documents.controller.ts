import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Request,
} from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import type {
  ApiResponse,
  ApiListResponse,
  Document,
  DocumentWithDetails,
  CreateDocumentDto,
  UpdateDocumentDto,
} from "@interface/shared";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(
    @Query("projectId") projectId?: string,
  ): Promise<ApiListResponse<DocumentWithDetails>> {
    const data = projectId
      ? await this.documentsService.findByProject(projectId)
      : await this.documentsService.findRecent();
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<Document>> {
    return { data: await this.documentsService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateDocumentDto,
    @Request() req: { user: { sub: string } },
  ): Promise<ApiResponse<Document>> {
    return { data: await this.documentsService.create(dto, req.user.sub) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<ApiResponse<Document>> {
    return { data: await this.documentsService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.documentsService.remove(id);
  }
}
