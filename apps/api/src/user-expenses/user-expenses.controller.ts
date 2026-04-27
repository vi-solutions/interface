import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, unlinkSync, mkdirSync } from "fs";
import { v4 as uuid } from "uuid";
import { UserExpensesService } from "./user-expenses.service";
import type {
  ApiResponse,
  ApiListResponse,
  UserExpense,
  UserExpenseWithDetails,
  CreateUserExpenseDto,
  UpdateUserExpenseDto,
} from "@interface/shared";

const uploadsDir = join(__dirname, "..", "..", "..", "uploads", "receipts");

@Controller("user-expenses")
export class UserExpensesController {
  constructor(private readonly userExpensesService: UserExpensesService) {}

  @Get()
  async findByProject(
    @Query("projectId") projectId?: string,
    @Query("userId") userId?: string,
  ): Promise<ApiListResponse<UserExpenseWithDetails>> {
    if (userId && !projectId) {
      const data = await this.userExpensesService.findByUser(userId);
      return { data, total: data.length };
    }
    const data = await this.userExpensesService.findByProject(projectId!);
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<UserExpense>> {
    return { data: await this.userExpensesService.findById(id) };
  }

  @Post()
  async create(
    @Body() dto: CreateUserExpenseDto,
  ): Promise<ApiResponse<UserExpense>> {
    return { data: await this.userExpensesService.create(dto) };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserExpenseDto,
  ): Promise<ApiResponse<UserExpense>> {
    return { data: await this.userExpensesService.update(id, dto) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<void> {
    await this.userExpensesService.remove(id);
  }

  @Post(":id/receipt")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(uploadsDir))
            mkdirSync(uploadsDir, { recursive: true });
          cb(null, uploadsDir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${uuid()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new BadRequestException("Only image files are allowed"), false);
      },
    }),
  )
  async uploadReceipt(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponse<{ receiptUrl: string }>> {
    if (!file) throw new BadRequestException("No file provided");

    // Delete old receipt file if one exists
    const existing = await this.userExpensesService.findById(id);
    if (existing.receiptUrl) {
      const oldPath = join(
        uploadsDir,
        existing.receiptUrl.replace("/uploads/receipts/", ""),
      );
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }

    const receiptUrl = `/uploads/receipts/${file.filename}`;
    await this.userExpensesService.saveReceiptUrl(id, receiptUrl);
    return { data: { receiptUrl } };
  }
}
