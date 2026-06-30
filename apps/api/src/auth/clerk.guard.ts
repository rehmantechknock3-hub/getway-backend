import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { verifyToken } from "@clerk/backend";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "./public.decorator";

// Clerk's default is 5s. Dev simulators and devs working offline routinely drift more than that
// against the API host's clock; 60s is the floor that keeps signed-in users from being kicked
// out by sub-minute drift while still rejecting stale tokens.
const CLOCK_SKEW_MS = 60_000;

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token   = this.extractToken(request);

    if (!token) throw new UnauthorizedException("No bearer token provided");

    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY");
    if (!secretKey) {
      this.logger.error("CLERK_SECRET_KEY is not configured");
      throw new UnauthorizedException("Auth secret not configured");
    }

    try {
      const payload = await verifyToken(token, { secretKey, clockSkewInMs: CLOCK_SKEW_MS });
      request.auth = payload;
      return true;
    } catch (error) {
      const requestId = request.requestId;
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[rid:${requestId}] Token verification failed for ${request.method} ${request.url}: ${reason}`
      );
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? (token ?? null) : null;
  }
}
