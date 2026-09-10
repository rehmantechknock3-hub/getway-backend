import { useQuery } from "@tanstack/react-query";

import {
  type ProviderPayoutRange,
  ProviderPayoutSummarySchema,
  type ProviderPayoutSummary,
  StripeConnectStatusSchema,
  type StripeConnectStatus,
} from "@repo/schemas";

import { apiClient } from "../client";

export const paymentKeys = {
  all: () => ["payments"] as const,
  providerPayoutSummary: (range: ProviderPayoutRange) =>
    ["payments", "provider", "payout-summary", range] as const,
  connectStatus: () => ["payments", "connect", "status"] as const,
};

export function useProviderPayoutSummary(
  range: ProviderPayoutRange,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: paymentKeys.providerPayoutSummary(range),
    queryFn: async (): Promise<ProviderPayoutSummary> => {
      const { data } = await apiClient.get<unknown>("/api/v1/provider/payments/payout-summary", {
        params: { range },
      });
      return ProviderPayoutSummarySchema.parse(data);
    },
    enabled: options?.enabled ?? true,
  });
}

/** Provider's Stripe Connect onboarding status — drives the "Set up payouts" banner on earnings. */
export function useConnectStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: paymentKeys.connectStatus(),
    queryFn: async (): Promise<StripeConnectStatus> => {
      const { data } = await apiClient.get<unknown>("/api/v1/payments/connect/status");
      return StripeConnectStatusSchema.parse(data);
    },
    enabled: options?.enabled ?? true,
  });
}
