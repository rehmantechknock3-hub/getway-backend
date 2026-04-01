import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ClerkUserPayload } from "../auth/webhook.controller";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromClerk(clerkUser: ClerkUserPayload) {
    const email     = clerkUser.email_addresses?.[0]?.email_address ?? "";
    const role      = (clerkUser.public_metadata?.role ?? "CUSTOMER") as UserRole;
    const firstName = clerkUser.first_name ?? "";
    const lastName  = clerkUser.last_name  ?? "";
    const avatarUrl = clerkUser.image_url  ?? null;

    return this.prisma.user.upsert({
      where:  { clerkId: clerkUser.id },
      update: { email, role, firstName, lastName, avatarUrl },
      create: { clerkId: clerkUser.id, email, role, firstName, lastName, avatarUrl },
    });
  }

  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async setRole(clerkId: string, role: UserRole) {
    return this.prisma.user.update({
      where:  { clerkId },
      data:   { role },
    });
  }
}
