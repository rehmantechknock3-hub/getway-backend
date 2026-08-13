import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import {
  AdminUpdateProviderVerificationSchema,
  AdminUpdateServiceActiveSchema,
  UserRole,
  VerificationStatus,
} from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { AdminService } from "./admin.service";

const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  role: UserRole.optional(),
  q: z.string().trim().max(100).optional(),
});

const ListProvidersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  status: VerificationStatus.optional(),
});

const ListServicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().trim().max(100).optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

@Controller("admin")
@Roles("ADMIN")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  getStats() {
    return this.adminService.getStats();
  }

  @Get("users")
  listUsers(
    @Req() req: Request,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    const parsed = ListUsersQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };
    return this.adminService.listUsers(q.page, q.limit, q.role, q.q, clerkId);
  }

  @Get("users/:id")
  getUser(@Req() req: Request, @Param("id") id: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    return this.adminService.getUserDetail(id, clerkId);
  }

  @Get("services")
  listServices(@Query() rawQuery: Record<string, string | undefined>) {
    const parsed = ListServicesQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };
    return this.adminService.listServices(q.page, q.limit, q.q, q.active);
  }

  @Patch("services/:id/active")
  async updateServiceActive(@Param("id") id: string, @Body() body: unknown) {
    const parsed = AdminUpdateServiceActiveSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid service active payload");
    }
    try {
      return await this.adminService.updateServiceActive(id, parsed.data);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      throw error;
    }
  }

  @Get("providers")
  listProviders(@Query() rawQuery: Record<string, string | undefined>) {
    const parsed = ListProvidersQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };
    return this.adminService.listProviders(q.page, q.limit, q.status);
  }

  @Get("providers/:id")
  getProvider(@Param("id") id: string) {
    return this.adminService.getProviderDetail(id);
  }

  @Patch("providers/:id/verification")
  async updateProviderVerification(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = AdminUpdateProviderVerificationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid verification payload");
    }
    try {
      return await this.adminService.updateProviderVerification(id, parsed.data);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      throw error;
    }
  }
}
