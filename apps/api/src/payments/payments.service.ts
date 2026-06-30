import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { PaymentStatus, ProviderPayoutRange, ProviderPayoutSummary } from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

const PAID_STATUSES: PaymentStatus[] = ["SUCCEEDED"];
const PENDING_STATUSES: PaymentStatus[] = ["PENDING", "PROCESSING"];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProviderPayoutSummary(
    clerkId: string,
    range: ProviderPayoutRange,
    requestId?: string
  ): Promise<ProviderPayoutSummary> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user) {
      this.logger.warn(`Provider payout user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can access payout summary");
    }
    if (!user.providerProfile) {
      return {
        range,
        currency: "USD",
        paidCount: 0,
        paidAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      };
    }

    const now = new Date();
    const fromDate = this.resolveRangeStart(range, now);
    const baseWhere = {
      providerId: user.providerProfile.id,
      ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
    };

    const [paidCount, paidAmountAgg, pendingCount, pendingAmountAgg, latestPayment] = await Promise.all([
      this.prisma.payment.count({
        where: { ...baseWhere, status: { in: PAID_STATUSES } },
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: { in: PAID_STATUSES } },
        _sum: { providerAmount: true },
      }),
      this.prisma.payment.count({
        where: { ...baseWhere, status: { in: PENDING_STATUSES } },
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: { in: PENDING_STATUSES } },
        _sum: { providerAmount: true },
      }),
      this.prisma.payment.findFirst({
        where: baseWhere,
        select: { currency: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      range,
      currency: latestPayment?.currency ?? "USD",
      paidCount,
      paidAmount: paidAmountAgg._sum.providerAmount ?? 0,
      pendingCount,
      pendingAmount: pendingAmountAgg._sum.providerAmount ?? 0,
    };
  }

  private resolveRangeStart(range: ProviderPayoutRange, now: Date): Date | null {
    if (range === "all") return null;
    const start = new Date(now);
    if (range === "week") {
      start.setDate(now.getDate() - 7);
      return start;
    }
    start.setMonth(now.getMonth() - 1);
    return start;
  }
}
