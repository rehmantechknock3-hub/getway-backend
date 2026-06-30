import { useQuery } from "@tanstack/react-query";

import {
  type ProviderPayoutRange,
  ProviderPayoutSummarySchema,
  type ProviderPayoutSummary,
} from "@repo/schemas";

import { apiClient } from "../client";

export const paymentKeys = {
  all: () => ["payments"] as const,
  providerPayoutSummary: (range: ProviderPayoutRange) =>
    ["payments", "provider", "payout-summary", range] as const,
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
