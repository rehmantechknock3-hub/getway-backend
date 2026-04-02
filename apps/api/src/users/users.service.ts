import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ClerkUserPayload } from "../auth/webhook.controller";
import type {
  CustomerOnboarding,
  ProviderOnboarding,
  SavedLocation,
  UpdateUserProfileInput,
} from "@repo/schemas";

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
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: {
        providerProfile: {
          select: {
            averageRating: true,
            totalReviews: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      ...user,
      providerMetrics: user.providerProfile
        ? {
            averageRating: user.providerProfile.averageRating,
            totalReviews: user.providerProfile.totalReviews,
          }
        : undefined,
    };
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateProfile(clerkId: string, input: UpdateUserProfileInput) {
    return this.prisma.user.update({
      where: { clerkId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
      },
    });
  }

  async updateSavedLocations(clerkId: string, savedLocations: SavedLocation[]) {
    return this.prisma.user.update({
      where: { clerkId },
      data: {
        savedLocations: savedLocations as Prisma.InputJsonValue,
      },
    });
  }

  async updateAvatar(clerkId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { clerkId },
      data: { avatarUrl },
    });
  }

  async updateCustomerOnboarding(clerkId: string, data: CustomerOnboarding) {
    return this.prisma.user.update({
      where: { clerkId },
      data: {
        onboardingCompleted: true,
        customerOnboarding: data as Prisma.InputJsonValue,
      },
    });
  }

  async updateProviderOnboarding(clerkId: string, data: ProviderOnboarding) {
    return this.prisma.user.update({
      where: { clerkId },
      data: {
        onboardingCompleted: true,
        providerOnboarding: data as Prisma.InputJsonValue,
        avatarUrl: data.profilePhotoUrl ?? undefined,
      },
    });
  }

  async setRole(clerkId: string, role: UserRole) {
    return this.prisma.user.update({
      where:  { clerkId },
      data:   { role },
    });
  }
}
