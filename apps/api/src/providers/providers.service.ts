import { Injectable, NotFoundException } from "@nestjs/common";

import { Prisma } from "@prisma/client";
import {
  safeParseProviderOnboardingJson,
  type ProviderPublicDetail,
  type ProviderPublicSummary,
  type ProviderServiceOffer,
} from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

type ProviderWithRelations = Prisma.ProviderProfileGetPayload<{
  include: {
    user: { select: { id: true; firstName: true; lastName: true; avatarUrl: true; providerOnboarding: true } };
    services: {
      where: { isActive: true };
      orderBy: { price: "asc" };
      include: { category: { select: { name: true } } };
    };
  };
}>;

type ServiceForSearch = {
  title: string;
  description: string | null;
  category: { name: string };
};

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private parseOnboarding(raw: Prisma.JsonValue | null | undefined) {
    const parsed = safeParseProviderOnboardingJson(raw);
    return parsed.success ? parsed.data : undefined;
  }

  private buildServiceSearchText(services: ServiceForSearch[]): string | undefined {
    if (!services.length) return undefined;
    const chunks: string[] = [];
    for (const s of services) {
      chunks.push(s.title);
      if (s.description) chunks.push(s.description);
      chunks.push(s.category.name);
    }
    const raw = chunks.join(" ").toLowerCase().trim();
    return raw.length > 0 ? raw : undefined;
  }

  private toSummary(row: ProviderWithRelations): ProviderPublicSummary {
    const onboarding = this.parseOnboarding(row.user.providerOnboarding);
    const firstService = row.services[0];
    return {
      id: row.id,
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      avatarUrl: row.user.avatarUrl ?? undefined,
      serviceCategory:
        onboarding?.serviceCategories?.length && onboarding.serviceCategories.length > 0
          ? onboarding.serviceCategories.join(" · ")
          : undefined,
      serviceDescription: onboarding?.serviceDescription,
      serviceArea: onboarding?.serviceArea,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews,
      isOnline: row.isOnline,
      verificationStatus: row.verificationStatus as ProviderPublicSummary["verificationStatus"],
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      startingPrice: firstService ? firstService.price : undefined,
      primaryServiceTitle: firstService ? firstService.title : undefined,
      primaryServiceId: firstService ? firstService.id : undefined,
      serviceSearchText: this.buildServiceSearchText(row.services),
    };
  }

  private toDetail(row: ProviderWithRelations): ProviderPublicDetail {
    const onboarding = this.parseOnboarding(row.user.providerOnboarding);
    const summary = this.toSummary(row);
    return {
      ...summary,
      bio: row.bio ?? undefined,
      experienceYears: onboarding?.experienceYears,
      hasTools: onboarding?.hasTools,
    };
  }

  async listPublicSummaries(
    lat?: number,
    lon?: number,
    radiusKm = 25
  ): Promise<ProviderPublicSummary[]> {
    // List by provider_profiles row, not users.role. Role controls which app shell you see; someone may still
    // have completed provider onboarding (profile row) while role is CUSTOMER, and should remain discoverable.
    const rows = await this.prisma.providerProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            providerOnboarding: true,
          },
        },
        services: {
          where: { isActive: true },
          orderBy: { price: "asc" },
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: { averageRating: "desc" },
    });

    let summaries = rows.map((r) => this.toSummary(r));

    if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      const near: { summary: ProviderPublicSummary; distanceKm: number }[] = [];
      const missingCoords: ProviderPublicSummary[] = [];
      for (const s of summaries) {
        if (s.latitude == null || s.longitude == null) {
          missingCoords.push(s);
          continue;
        }
        const d = distanceKm(lat, lon, s.latitude, s.longitude);
        if (d <= radiusKm) near.push({ summary: s, distanceKm: d });
      }
      near.sort((a, b) => a.distanceKm - b.distanceKm);
      summaries = [...near.map((x) => x.summary), ...missingCoords];
    }

    return summaries;
  }

  async findPublicDetail(providerProfileId: string): Promise<ProviderPublicDetail> {
    const row = await this.prisma.providerProfile.findFirst({
      where: { id: providerProfileId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            providerOnboarding: true,
          },
        },
        services: {
          where: { isActive: true },
          orderBy: { price: "asc" },
          include: { category: { select: { name: true } } },
        },
      },
    });

    if (!row) throw new NotFoundException("Provider not found");

    return this.toDetail(row);
  }

  async listActiveServices(providerProfileId: string): Promise<ProviderServiceOffer[]> {
    const exists = await this.prisma.providerProfile.findFirst({
      where: { id: providerProfileId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Provider not found");

    const services = await this.prisma.service.findMany({
      where: { providerId: providerProfileId, isActive: true },
      include: { category: { select: { name: true } } },
      orderBy: { price: "asc" },
    });

    return services.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? undefined,
      price: s.price,
      duration: s.duration,
      categoryName: s.category.name,
      isActive: s.isActive,
    }));
  }

  private readonly providerSummaryInclude = {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        providerOnboarding: true,
      },
    },
    services: {
      where: { isActive: true },
      orderBy: { price: "asc" as const },
      include: { category: { select: { name: true } } },
    },
  } as const;

  /** Preserves caller order of `ids` (omits missing profiles). */
  async findPublicSummariesByIds(ids: string[]): Promise<ProviderPublicSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.providerProfile.findMany({
      where: { id: { in: ids } },
      include: this.providerSummaryInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, this.toSummary(r)]));
    return ids.map((id) => byId.get(id)).filter((s): s is ProviderPublicSummary => s != null);
  }
}
