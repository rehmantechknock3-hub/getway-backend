import {
  BadRequestException,
  Controller,
  Body,
  ForbiddenException,
  Post,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { createClerkClient } from "@clerk/backend";
import { SetRoleSchema } from "@repo/schemas";

import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  private readonly clerk: ReturnType<typeof createClerkClient>;

  constructor(
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

    const clerkUser = await this.clerk.users.getUser(clerkId);
    const existingRole = clerkUser.publicMetadata?.role;
    if (existingRole !== undefined && existingRole !== null) {
      throw new ForbiddenException("Role is already set");
    }

    const { role } = parsed;

    await this.clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: { role },
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
