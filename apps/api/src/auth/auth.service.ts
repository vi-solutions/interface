import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { UsersService } from "../users/users.service";
import type { AuthResponse } from "@interface/shared";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await this.usersService.verifyPassword(
      password,
      user.password_hash,
    );
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const token = this.signToken(user.id, user.email, user.is_admin);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.is_admin,
      },
    };
  }

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException("Email already registered");

    const user = await this.usersService.create(email, password, name);
    const token = this.signToken(user.id, user.email, user.isAdmin);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
      },
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findByIdWithHash(userId);
    if (!user) throw new UnauthorizedException("User not found");

    const valid = await this.usersService.verifyPassword(
      currentPassword,
      user.password_hash,
    );
    if (!valid)
      throw new UnauthorizedException("Current password is incorrect");

    await this.usersService.updatePassword(userId, newPassword);
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private signToken(id: string, email: string, isAdmin: boolean): string {
    return jwt.sign(
      { sub: id, email, isAdmin } satisfies JwtPayload,
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      },
    );
  }
}
