import { useMutation, useQueryClient } from "@tanstack/react-query";

import { StripeConnectOnboardingLinkSchema, type StripeConnectOnboardingLink } from "@repo/schemas";

import { apiClient } from "../client";
import { paymentKeys } from "../queries/payments.queries";

/** Creates (or resumes) the provider's Stripe Express onboarding link. */
export function useCreateConnectOnboardingLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<StripeConnectOnboardingLink> => {
      const { data } = await apiClient.post<unknown>("/api/v1/payments/connect/onboarding-link");
      return StripeConnectOnboardingLinkSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.connectStatus() });
    },
  });
}
