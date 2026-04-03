import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { createClerkClient } from "@clerk/backend";
import { UsersService } from "../users/users.service";
import { z } from "zod";

const SetRoleSchema = z.object({
  role: z.enum(["CUSTOMER", "PROVIDER"]),
});

@Controller("auth")
export class AuthController {
  private readonly clerk = createClerkClient({
    secretKey: process.env["CLERK_SECRET_KEY"],
  });

  constructor(private readonly usersService: UsersService) {}

  @Post("set-role")
  async setRole(@Body() body: unknown, @Req() req: Request) {
    const parsed = SetRoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid role");

    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const { role } = parsed.data;

    await this.clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: { role },
    });

    // Fetch the full Clerk user so we can upsert with complete data.
    // This handles the race condition where the user.created webhook hasn't
    // fired yet and the DB row doesn't exist.
    const clerkUser = await this.clerk.users.getUser(clerkId);
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
