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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentsService } from "./documents.service";
import { GoogleDriveService } from "../google-drive/google-drive.service";
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
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly drive: GoogleDriveService,
  ) {}

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

  /** Upload a file to Google Drive and create a document record */
  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { projectId: string; category: string },
    @Request() req: { user: { sub: string } },
  ): Promise<ApiResponse<Document>> {
    if (!file) throw new BadRequestException("No file provided");

    const project = await this.documentsService.getProjectForUpload(
      body.projectId,
    );
    if (!project.code)
      throw new BadRequestException("Project must have a code to upload files");

    // Ensure project folder structure exists
    const projectFolderId = await this.drive.ensureProjectFolders(
      body.projectId,
      project.code,
      project.name,
    );

    // Find the category subfolder
    const subFolderId = await this.drive.getSubfolderId(
      projectFolderId,
      body.category,
    );

    // Upload to Drive
    const { fileId, webViewLink } = await this.drive.uploadFile({
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      parentFolderId: subFolderId,
    });

    // Create document record
    const doc = await this.documentsService.create(
      {
        projectId: body.projectId,
        name: file.originalname,
        googleDriveUrl: webViewLink,
        googleDriveFileId: fileId,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        category: body.category,
      },
      req.user.sub,
    );

    return { data: doc };
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
