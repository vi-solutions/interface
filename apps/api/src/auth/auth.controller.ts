import { Controller, Post, Put, Body, Request } from "@nestjs/common";
import { AuthService, JwtPayload } from "./auth.service";
import { Public } from "./public.decorator";
import type {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  AuthResponse,
  ApiResponse,
} from "@interface/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto): Promise<ApiResponse<AuthResponse>> {
    return { data: await this.authService.login(dto.email, dto.password) };
  }

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto): Promise<ApiResponse<AuthResponse>> {
    return {
      data: await this.authService.register(dto.email, dto.password, dto.name),
    };
  }

  @Put("change-password")
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Request() req: { user: { sub: string } },
  ): Promise<ApiResponse<{ message: string }>> {
    await this.authService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { data: { message: "Password changed successfully" } };
  }

  @Post("refresh")
  async refresh(
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponse<AuthResponse>> {
    return { data: await this.authService.refresh(req.user) };
  }
}
