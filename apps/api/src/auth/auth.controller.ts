import {
  BadRequestException,
  Controller,
  Body,
  Post,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { createClerkClient } from "@clerk/backend";
import { SetRoleSchema } from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  private readonly clerk: ReturnType<typeof createClerkClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {
    this.clerk = createClerkClient({
      secretKey: this.configService.get<string>("CLERK_SECRET_KEY"),
    });
  }

  @Post("set-role")
  async setRole(@Body() body: unknown, @Req() req: Request) {
    let parsed: { role: "CUSTOMER" | "PROVIDER" };
    try {
      parsed = SetRoleSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid role");
    }

    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const { role } = parsed;

    const clerkUser = await this.prisma.$transaction(async (tx) => {
      // Serialize role assignment attempts per user to avoid TOCTOU races.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clerkId}))`;

      const current = await this.clerk.users.getUser(clerkId);

      await this.clerk.users.updateUserMetadata(clerkId, {
        publicMetadata: { role },
      });

      return current;
    });

    const user = await this.usersService.upsertFromClerk({
      id: clerkUser.id,
      primary_email_address_id: clerkUser.primaryEmailAddressId,
      email_addresses: clerkUser.emailAddresses.map((e) => ({
        id: e.id,
        email_address: e.emailAddress,
      })),
      first_name:      clerkUser.firstName,
      last_name:       clerkUser.lastName,
      image_url:       clerkUser.imageUrl,
      public_metadata: { role },
    });
    return user;
  }
}
