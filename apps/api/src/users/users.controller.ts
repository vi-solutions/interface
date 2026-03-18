import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Request,
  ForbiddenException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import type {
  ApiListResponse,
  ApiResponse,
  User,
  CreateUserDto,
  UpdateUserDto,
} from "@interface/shared";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<ApiListResponse<User>> {
    const data = await this.usersService.findAll();
    return { data, total: data.length };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ApiResponse<User>> {
    return { data: await this.usersService.findById(id) };
  }

  @Post()
  async create(
    @Body() body: CreateUserDto,
    @Request() req: { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiResponse<User>> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    const user = await this.usersService.create(
      body.email,
      body.password,
      body.name,
    );
    if (body.isAdmin) {
      return { data: await this.usersService.setAdmin(user.id, true) };
    }
    return { data: user };
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateUserDto,
    @Request() req: { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiResponse<User>> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    return { data: await this.usersService.update(id, body) };
  }

  @Put(":id/admin")
  async setAdmin(
    @Param("id") id: string,
    @Body() body: { isAdmin: boolean },
    @Request() req: { user: { sub: string; isAdmin: boolean } },
  ): Promise<ApiResponse<User>> {
    if (!req.user.isAdmin)
      throw new ForbiddenException("Admin access required");
    return { data: await this.usersService.setAdmin(id, body.isAdmin) };
  }
}
