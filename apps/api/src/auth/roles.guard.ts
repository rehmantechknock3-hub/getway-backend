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

function jwtPublicMetadataRole(auth: unknown): string | undefined {
  const payload = auth as {
    public_metadata?: { role?: string };
    /** Present on some Clerk session templates */
    metadata?: { role?: string };
  } | undefined;
  return payload?.public_metadata?.role ?? payload?.metadata?.role;
}

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

    const dbRole = user.role as UserRole;
    if (requiredRoles.includes(dbRole)) return true;

    const jwtRole = jwtPublicMetadataRole(request.auth) as UserRole | undefined;
    const onlyProvider =
      requiredRoles.length === 1 && requiredRoles[0] === "PROVIDER";
    if (
      onlyProvider &&
      jwtRole === "PROVIDER" &&
      dbRole === "CUSTOMER"
    ) {
      return true;
    }

    throw new ForbiddenException(`Requires role: ${requiredRoles.join(" or ")}`);
  }
}
