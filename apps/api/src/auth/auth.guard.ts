import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing token");
    }

    const token = header.slice(7);
    const payload = this.authService.verifyToken(token);
    request.user = payload;
    return true;
  }
}
