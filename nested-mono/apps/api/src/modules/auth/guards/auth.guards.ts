import { Injectable, CanActivate, ExecutionContext, SetMetadata } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";

// Protects REST routes with the JWT strategy.
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

// Kicks off each social OAuth redirect flow.
@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {}

@Injectable()
export class KakaoAuthGuard extends AuthGuard("kakao") {}

@Injectable()
export class NaverAuthGuard extends AuthGuard("naver") {}

@Injectable()
export class AppleAuthGuard extends AuthGuard("apple") {}

// ── Role-based access ──
export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return !!user && roles.includes(user.role);
  }
}
