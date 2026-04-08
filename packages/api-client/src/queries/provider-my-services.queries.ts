import { useQuery } from "@tanstack/react-query";

import type { ProviderMyService, ServiceCategory } from "@repo/schemas";

import { apiClient } from "../client";

export const providerMyServicesKeys = {
  all: () => ["provider", "my-services"] as const,
  list: () => ["provider", "my-services", "list"] as const,
  categories: () => ["provider", "my-services", "categories"] as const,
};

export function useMyProviderServices(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: providerMyServicesKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderMyService[]>("/api/v1/provider/services");
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useProviderServiceCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: providerMyServicesKeys.categories(),
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceCategory[]>(
        "/api/v1/provider/services/categories"
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
