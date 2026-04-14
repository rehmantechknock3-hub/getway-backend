import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import type { Prisma } from "@prisma/client";
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  ProviderMyService,
  ServiceCategory,
  UpdateServiceInput,
} from "@repo/schemas";
import { safeParseProviderOnboardingJson } from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

const TTL_CATEGORIES_MS = 90_000;
const TTL_MY_SERVICES_MS = 25_000;

function myServicesCacheKey(clerkId: string): string {
  return `svc:mine:${clerkId}`;
}

function categoriesCacheKey(clerkId: string): string {
  return `gn:srv-categories:v2:${clerkId}`;
}

@Injectable()
export class ProviderServicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  private async requireProviderContext(clerkId: string): Promise<{
    userId: string;
    providerOnboarding: Prisma.JsonValue | null;
    providerProfileId: string;
    dismissedCategoryIds: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can manage services");
    }
    if (!user.providerProfile) throw new NotFoundException("Provider profile not found");
    return {
      userId: user.id,
      providerOnboarding: user.providerOnboarding as Prisma.JsonValue | null,
      providerProfileId: user.providerProfile.id,
      dismissedCategoryIds: user.providerProfile.dismissedServiceCategoryIds ?? [],
    };
  }

  private async requireProviderProfileId(clerkId: string): Promise<string> {
    const ctx = await this.requireProviderContext(clerkId);
    return ctx.providerProfileId;
  }

  private async removeOnboardingCategoryByName(
    userId: string,
    providerOnboarding: Prisma.JsonValue | null,
    categoryName: string
  ): Promise<void> {
    const parsed = safeParseProviderOnboardingJson(providerOnboarding);
    if (!parsed.success) return;

    const lowered = categoryName.trim().toLowerCase();
    if (!lowered.length) return;
    const nextCategories = parsed.data.serviceCategories.filter(
      (name) => name.trim().toLowerCase() !== lowered
    );
    if (nextCategories.length === parsed.data.serviceCategories.length) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        providerOnboarding: {
          ...parsed.data,
          serviceCategories: nextCategories,
        } as Prisma.InputJsonValue,
      },
    });
  }

  /** Category is assignable if it is shared, owned by this provider, or already used by one of their services. */
  private async requireAssignableCategory(
    categoryId: string,
    providerProfileId: string,
    dismissedCategoryIds: string[]
  ): Promise<void> {
    const cat = await this.prisma.serviceCategory.findFirst({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException("Category not found");
    if (dismissedCategoryIds.includes(categoryId)) {
      throw new BadRequestException("This category is hidden for your account");
    }
    const ownedOrShared =
      cat.providerId === null || cat.providerId === providerProfileId;
    if (ownedOrShared) return;
    const inUseHere = await this.prisma.service.count({
      where: { providerId: providerProfileId, categoryId },
    });
    if (inUseHere > 0) return;
    throw new ForbiddenException("You cannot use this category");
  }

  private toMyServiceDto(row: {
    id: string;
    title: string;
    description: string | null;
    price: number;
    priceCurrency: string;
    duration: number;
    categoryId: string;
    isActive: boolean;
    category: { name: string };
  }): ProviderMyService {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      price: row.price,
      priceCurrency: row.priceCurrency as ProviderMyService["priceCurrency"],
      duration: row.duration,
      categoryName: row.category.name,
      categoryId: row.categoryId,
      isActive: row.isActive,
    };
  }

  async listMyServices(clerkId: string): Promise<ProviderMyService[]> {
    const cacheKey = myServicesCacheKey(clerkId);
    const hit = await this.cache.get<ProviderMyService[]>(cacheKey);
    if (hit) return hit;

    const providerId = await this.requireProviderProfileId(clerkId);
    const rows = await this.prisma.service.findMany({
      where: { providerId },
      include: { category: { select: { name: true } } },
      orderBy: [{ isActive: "desc" }, { price: "asc" }],
    });
    const out = rows.map((r) => this.toMyServiceDto(r));
    await this.cache.set(cacheKey, out, TTL_MY_SERVICES_MS);
    return out;
  }

  async listCategories(clerkId: string): Promise<ServiceCategory[]> {
    const cacheKey = categoriesCacheKey(clerkId);
    const hit = await this.cache.get<ServiceCategory[]>(cacheKey);
    if (hit) return hit;

    const { providerProfileId, dismissedCategoryIds } = await this.requireProviderContext(clerkId);

    const usedRows = await this.prisma.service.findMany({
      where: { providerId: providerProfileId },
      select: { categoryId: true },
      distinct: ["categoryId"],
    });
    const usedCategoryIds = usedRows.map((r) => r.categoryId);

    const orFilters: Prisma.ServiceCategoryWhereInput[] = [
      { providerId: null },
      { providerId: providerProfileId },
    ];
    if (usedCategoryIds.length > 0) {
      orFilters.push({ id: { in: usedCategoryIds } });
    }

    const where: Prisma.ServiceCategoryWhereInput = {
      OR: orFilters,
      ...(dismissedCategoryIds.length > 0 ? { id: { notIn: dismissedCategoryIds } } : {}),
    };

    const rows = await this.prisma.serviceCategory.findMany({
      where,
      orderBy: { name: "asc" },
    });
    const out = rows.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description ?? undefined,
    }));
    await this.cache.set(cacheKey, out, TTL_CATEGORIES_MS);
    return out;
  }

  async createCategory(clerkId: string, input: CreateServiceCategoryInput): Promise<ServiceCategory> {
    const { providerProfileId } = await this.requireProviderContext(clerkId);
    const name = input.name.trim();
    if (!name.length) throw new BadRequestException("Category name is required");

    const own = await this.prisma.serviceCategory.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        providerId: providerProfileId,
      },
    });
    if (own) {
      return {
        id: own.id,
        name: own.name,
        icon: own.icon,
        description: own.description ?? undefined,
      };
    }

    const shared = await this.prisma.serviceCategory.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        providerId: null,
      },
    });
    if (shared) {
      return {
        id: shared.id,
        name: shared.name,
        icon: shared.icon,
        description: shared.description ?? undefined,
      };
    }

    const row = await this.prisma.serviceCategory.create({
      data: { name, icon: "pricetag-outline", providerId: providerProfileId },
    });
    await this.cache.del(categoriesCacheKey(clerkId));
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      description: row.description ?? undefined,
    };
  }

  /**
   * Deletes an unused category. Providers may delete their own custom rows; shared (catalog) rows may be deleted
   * only when no service references them.
   */
  async deleteCategory(clerkId: string, categoryId: string): Promise<void> {
    const { userId, providerOnboarding, providerProfileId, dismissedCategoryIds } =
      await this.requireProviderContext(clerkId);
    const cat = await this.prisma.serviceCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException("Category not found");
    if (cat.providerId !== null && cat.providerId !== providerProfileId) {
      throw new ForbiddenException("You can only delete categories you created");
    }

    await this.prisma.service.deleteMany({
      where: { providerId: providerProfileId, categoryId },
    });
    if (cat.providerId === null) {
      if (!dismissedCategoryIds.includes(categoryId)) {
        await this.prisma.providerProfile.update({
          where: { id: providerProfileId },
          data: {
            dismissedServiceCategoryIds: [...dismissedCategoryIds, categoryId],
          },
        });
      }
    } else {
      await this.prisma.serviceCategory.delete({ where: { id: categoryId } });
    }

    await this.cache.del(categoriesCacheKey(clerkId));
    await this.cache.del(myServicesCacheKey(clerkId));
    await this.removeOnboardingCategoryByName(userId, providerOnboarding, cat.name);
  }

  async create(clerkId: string, input: CreateServiceInput): Promise<ProviderMyService> {
    const { providerProfileId, dismissedCategoryIds } = await this.requireProviderContext(clerkId);
    await this.requireAssignableCategory(
      input.categoryId,
      providerProfileId,
      dismissedCategoryIds
    );

    const row = await this.prisma.service.create({
      data: {
        providerId: providerProfileId,
        categoryId: input.categoryId,
        title: input.title.trim(),
        description: input.description?.trim() ? input.description.trim() : null,
        price: input.price,
        priceCurrency: input.priceCurrency,
        duration: input.duration,
        isActive: true,
      },
      include: { category: { select: { name: true } } },
    });
    await this.cache.del(myServicesCacheKey(clerkId));
    return this.toMyServiceDto(row);
  }

  async update(
    clerkId: string,
    serviceId: string,
    input: UpdateServiceInput
  ): Promise<ProviderMyService> {
    const { providerProfileId, dismissedCategoryIds } = await this.requireProviderContext(clerkId);
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId: providerProfileId },
    });
    if (!existing) throw new NotFoundException("Service not found");

    if (input.categoryId !== undefined) {
      await this.requireAssignableCategory(
        input.categoryId,
        providerProfileId,
        dismissedCategoryIds
      );
    }

    const data: Prisma.ServiceUpdateInput = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (!t.length) throw new BadRequestException("Title cannot be empty");
      data.title = t;
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() ? input.description.trim() : null;
    }
    if (input.price !== undefined) data.price = input.price;
    if (input.priceCurrency !== undefined) data.priceCurrency = input.priceCurrency;
    if (input.duration !== undefined) data.duration = input.duration;
    if (input.categoryId !== undefined) {
      data.category = { connect: { id: input.categoryId } };
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (Object.keys(data).length === 0) {
      const row = await this.prisma.service.findFirst({
        where: { id: serviceId, providerId: providerProfileId },
        include: { category: { select: { name: true } } },
      });
      if (!row) throw new NotFoundException("Service not found");
      return this.toMyServiceDto(row);
    }

    const row = await this.prisma.service.update({
      where: { id: serviceId },
      data,
      include: { category: { select: { name: true } } },
    });
    await this.cache.del(myServicesCacheKey(clerkId));
    await this.cache.del(categoriesCacheKey(clerkId));
    return this.toMyServiceDto(row);
  }

  async remove(clerkId: string, serviceId: string): Promise<void> {
    const { userId, providerOnboarding, providerProfileId, dismissedCategoryIds } =
      await this.requireProviderContext(clerkId);
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId: providerProfileId },
      select: { id: true, categoryId: true },
    });
    if (!existing) throw new NotFoundException("Service not found");

    await this.prisma.service.delete({ where: { id: serviceId } });
    const stillInUse = await this.prisma.service.count({
      where: { providerId: providerProfileId, categoryId: existing.categoryId },
    });
    if (stillInUse === 0) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: existing.categoryId },
      });
      if (category?.providerId === providerProfileId) {
        await this.prisma.serviceCategory.delete({ where: { id: category.id } });
        await this.removeOnboardingCategoryByName(userId, providerOnboarding, category.name);
      } else if (
        category?.providerId === null &&
        !dismissedCategoryIds.includes(existing.categoryId)
      ) {
        await this.prisma.providerProfile.update({
          where: { id: providerProfileId },
          data: {
            dismissedServiceCategoryIds: [...dismissedCategoryIds, existing.categoryId],
          },
        });
        await this.removeOnboardingCategoryByName(userId, providerOnboarding, category.name);
      }
    }
    await this.cache.del(myServicesCacheKey(clerkId));
    await this.cache.del(categoriesCacheKey(clerkId));
  }
}
