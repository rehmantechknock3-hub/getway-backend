import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { verifyToken } from "@clerk/backend";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token   = this.extractToken(request);

    if (!token) throw new UnauthorizedException("No bearer token provided");

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env["CLERK_SECRET_KEY"],
      });
      request.auth = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? (token ?? null) : null;
  }
}
