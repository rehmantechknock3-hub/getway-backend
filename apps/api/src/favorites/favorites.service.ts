import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { FavoriteProviderListResponse } from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";
import { ProvidersService } from "../providers/providers.service";

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providersService: ProvidersService,
  ) {}

  async list(
    clerkId: string,
    lat?: number,
    lon?: number,
    requestId?: string
  ): Promise<FavoriteProviderListResponse> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can list favorites");
    }

    const links = await this.prisma.favoriteProvider.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { providerId: true },
    });
    const ids = links.map((l) => l.providerId);
    const hasGeo =
      lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
    const data = hasGeo
      ? await this.providersService.findPublicSummariesByIdsWithDrivingDistances(
          ids,
          lat,
          lon,
          requestId
        )
      : await this.providersService.findPublicSummariesByIds(ids);
    return { data };
  }

  async add(clerkId: string, providerId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can save favorites");
    }

    const provider = await this.prisma.providerProfile.findFirst({
      where: { id: providerId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException("Provider not found");

    await this.prisma.favoriteProvider.upsert({
      where: {
        customerId_providerId: { customerId: user.id, providerId },
      },
      create: { customerId: user.id, providerId },
      update: {},
    });
  }

  async remove(clerkId: string, providerId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can remove favorites");
    }

    await this.prisma.favoriteProvider.deleteMany({
      where: { customerId: user.id, providerId },
    });
  }
}
