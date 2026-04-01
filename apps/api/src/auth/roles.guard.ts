import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { UserRole } from "@repo/schemas";
import { UsersService } from "../users/users.service";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — allow any authenticated user through
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const clerkId = request.auth?.sub;

    // ClerkAuthGuard runs first and sets request.auth; this should never be null here
    if (!clerkId) throw new ForbiddenException("No authenticated user");

    const user = await this.usersService.findByClerkId(clerkId);

    if (!user) throw new ForbiddenException("User not found");

    if (!requiredRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException(
        `Requires role: ${requiredRoles.join(" or ")}`,
      );
    }

    return true;
  }
}
