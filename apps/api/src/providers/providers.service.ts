import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  parseAvailabilityDays,
  safeParseProviderOnboardingJson,
  type ProviderBookedSlot,
  type ProviderPublicDetail,
  type ProviderPublicSummary,
  type ProviderServiceOffer,
} from "@repo/schemas";
import { haversineDistance } from "@repo/utils";

import { GoogleMapsService, type DrivingDistanceResult } from "../maps/google-maps.service";
import { PrismaService } from "../prisma/prisma.service";

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
  priceCurrency: string;
  category: { name: string };
};

type ProviderLocation = { latitude: number; longitude: number };

function toServiceCurrency(
  value: string | undefined
): ProviderPublicSummary["startingPriceCurrency"] {
  if (
    value === "USD" ||
    value === "EUR" ||
    value === "GBP" ||
    value === "AED" ||
    value === "SAR" ||
    value === "PKR"
  ) {
    return value;
  }
  return undefined;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService
  ) {}

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
      startingPriceCurrency: firstService ? toServiceCurrency(firstService.priceCurrency) : undefined,
      primaryServiceTitle: firstService ? firstService.title : undefined,
      primaryServiceId: firstService ? firstService.id : undefined,
      activeServiceCount: row.services.length,
      serviceSearchText: this.buildServiceSearchText(row.services),
    };
  }

  private extractProviderLocations(row: ProviderWithRelations): ProviderLocation[] {
    const onboarding = this.parseOnboarding(row.user.providerOnboarding);
    const locations: ProviderLocation[] = [];
    for (const location of onboarding?.shopLocations ?? []) {
      if (typeof location.latitude === "number" && typeof location.longitude === "number") {
        locations.push({ latitude: location.latitude, longitude: location.longitude });
      }
    }
    if (locations.length === 0 && row.latitude != null && row.longitude != null) {
      locations.push({ latitude: row.latitude, longitude: row.longitude });
    }
    return locations;
  }

  private toDetail(row: ProviderWithRelations): ProviderPublicDetail {
    const onboarding = this.parseOnboarding(row.user.providerOnboarding);
    const summary = this.toSummary(row);
    return {
      ...summary,
      bio: row.bio ?? undefined,
      experienceYears: onboarding?.experienceYears,
      hasTools: onboarding?.hasTools,
      availabilityDays: parseAvailabilityDays(row.availabilityDays),
    };
  }

  private async listBookedSlots(providerProfileId: string): Promise<ProviderBookedSlot[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        providerId: providerProfileId,
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
        scheduledAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      select: {
        scheduledAt: true,
        service: { select: { duration: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    return rows.map((row) => ({
      scheduledAt: row.scheduledAt,
      durationMinutes: row.service.duration,
    }));
  }

  async listPublicSummaries(
    lat?: number,
    lon?: number,
    radiusKm = 25,
    requestId?: string
  ): Promise<ProviderPublicSummary[]> {
    // List by provider_profiles row, not users.role. Role controls which app shell you see; someone may still
    // have completed provider onboarding (profile row) while role is CUSTOMER, and should remain discoverable.
    const rows = await this.prisma.providerProfile.findMany({
      where: { verificationStatus: "APPROVED" },
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
      type NearEntry = {
        summary: ProviderPublicSummary;
        haversineKm: number;
        destLat: number;
        destLon: number;
      };
      const near: NearEntry[] = [];
      for (const row of rows) {
        const s = this.toSummary(row);
        const locations = this.extractProviderLocations(row);
        if (locations.length === 0) {
          continue;
        }
        let best = { distance: Number.POSITIVE_INFINITY, lat: 0, lon: 0 };
        for (const location of locations) {
          const d = haversineDistance(lat, lon, location.latitude, location.longitude);
          if (d < best.distance) {
            best = { distance: d, lat: location.latitude, lon: location.longitude };
          }
        }
        // First gate: straight-line to nearest pin keeps the Matrix batch small. Final inclusion uses the same
        // distance we show (driving when available), so radius matches the UI (Haversine can be < radius while
        // road distance is not).
        if (best.distance <= radiusKm) {
          near.push({
            summary: s,
            haversineKm: best.distance,
            destLat: best.lat,
            destLon: best.lon,
          });
        }
      }

      const drivingMap = await this.googleMaps.resolveDrivingDistances(
        lat,
        lon,
        near.map((n) => ({
          providerId: n.summary.id,
          destLat: n.destLat,
          destLon: n.destLon,
          fallbackKm: n.haversineKm,
        })),
        requestId
      );

      const radiusMeters = radiusKm * 1000;
      type Scored = { n: NearEntry; resolved: DrivingDistanceResult };
      const scored: Scored[] = [];
      for (const n of near) {
        const fromMap = drivingMap.get(n.summary.id);
        const haversineMeters = Math.max(0, Math.round(n.haversineKm * 1000));
        const straightFallback: DrivingDistanceResult = {
          km: haversineMeters / 1000,
          meters: haversineMeters,
          kind: "STRAIGHT_LINE",
        };
        const resolved = fromMap ?? straightFallback;
        if (resolved.meters <= radiusMeters) {
          scored.push({ n, resolved });
        }
      }

      scored.sort((a, b) => a.resolved.km - b.resolved.km);

      summaries = scored.map(({ n, resolved }) => ({
        ...n.summary,
        distanceKm: resolved.km,
        distanceMeters: resolved.meters,
        nearestLocationLatitude: n.destLat,
        nearestLocationLongitude: n.destLon,
        distanceKind: resolved.kind,
      }));
    }

    return summaries;
  }

  async findPublicDetail(
    providerProfileId: string,
    requestId?: string
  ): Promise<ProviderPublicDetail> {
    const row = await this.prisma.providerProfile.findFirst({
      where: { id: providerProfileId, verificationStatus: "APPROVED" },
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

    if (!row) {
      this.logger.warn(`Provider profile not found: ${providerProfileId} [rid:${requestId}]`);
      throw new NotFoundException("Provider not found");
    }

    const bookedSlots = await this.listBookedSlots(row.id);
    return { ...this.toDetail(row), bookedSlots };
  }

  async listActiveServices(providerProfileId: string, requestId?: string): Promise<ProviderServiceOffer[]> {
    const exists = await this.prisma.providerProfile.findFirst({
      where: { id: providerProfileId, verificationStatus: "APPROVED" },
      select: { id: true },
    });
    if (!exists) {
      this.logger.warn(`Provider services not found profileId=${providerProfileId} [rid:${requestId}]`);
      throw new NotFoundException("Provider not found");
    }

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
      priceCurrency: s.priceCurrency as ProviderServiceOffer["priceCurrency"],
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

  /**
   * Same distance semantics as geo `listPublicSummaries` (nearest shop + driving Matrix), preserving `ids` order.
   * Used for favorites so Saved matches Discover for the same customer coordinates.
   */
  async findPublicSummariesByIdsWithDrivingDistances(
    ids: string[],
    lat: number,
    lon: number,
    requestId?: string
  ): Promise<ProviderPublicSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.providerProfile.findMany({
      where: { id: { in: ids } },
      include: this.providerSummaryInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    type NearEntry = {
      summary: ProviderPublicSummary;
      haversineKm: number;
      destLat: number;
      destLon: number;
    };
    const near: NearEntry[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) continue;
      const summary = this.toSummary(row);
      const locations = this.extractProviderLocations(row);
      if (locations.length === 0) continue;
      let best = { distance: Number.POSITIVE_INFINITY, destLat: 0, destLon: 0 };
      for (const location of locations) {
        const d = haversineDistance(lat, lon, location.latitude, location.longitude);
        if (d < best.distance) {
          best = { distance: d, destLat: location.latitude, destLon: location.longitude };
        }
      }
      near.push({
        summary,
        haversineKm: best.distance,
        destLat: best.destLat,
        destLon: best.destLon,
      });
    }

    const drivingMap =
      near.length > 0
        ? await this.googleMaps.resolveDrivingDistances(
            lat,
            lon,
            near.map((n) => ({
              providerId: n.summary.id,
              destLat: n.destLat,
              destLon: n.destLon,
              fallbackKm: n.haversineKm,
            })),
            requestId
          )
        : new Map<string, DrivingDistanceResult>();

    const withDistance = new Map<string, ProviderPublicSummary>();
    for (const n of near) {
      const fromMap = drivingMap.get(n.summary.id);
      const haversineMeters = Math.max(0, Math.round(n.haversineKm * 1000));
      const straightFallback: DrivingDistanceResult = {
        km: haversineMeters / 1000,
        meters: haversineMeters,
        kind: "STRAIGHT_LINE",
      };
      const resolved = fromMap ?? straightFallback;
      withDistance.set(n.summary.id, {
        ...n.summary,
        distanceKm: resolved.km,
        distanceMeters: resolved.meters,
        nearestLocationLatitude: n.destLat,
        nearestLocationLongitude: n.destLon,
        distanceKind: resolved.kind,
      });
    }

    return ids
      .map((id) => {
        const hit = withDistance.get(id);
        if (hit) return hit;
        const row = byId.get(id);
        return row ? this.toSummary(row) : undefined;
      })
      .filter((s): s is ProviderPublicSummary => s != null);
  }
}
