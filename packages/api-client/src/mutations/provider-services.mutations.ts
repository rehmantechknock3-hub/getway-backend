import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  ProviderMyService,
  ServiceCategory,
  UpdateServiceInput,
} from "@repo/schemas";

import { apiClient } from "../client";
import { providerKeys } from "../queries/providers.queries";
import { providerMyServicesKeys } from "../queries/provider-my-services.queries";
import { userKeys } from "../queries/users.queries";

export function useCreateProviderServiceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceCategoryInput) => {
      const { data } = await apiClient.post<ServiceCategory>(
        "/api/v1/provider/services/categories",
        input
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.categories() });
    },
  });
}

export function useDeleteProviderServiceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      await apiClient.delete(`/api/v1/provider/services/categories/${categoryId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.categories() });
      await queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.list() });
      await queryClient.invalidateQueries({ queryKey: providerKeys.all() });
    },
  });
}

export function useCreateProviderService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceInput) => {
      const { data } = await apiClient.post<ProviderMyService>("/api/v1/provider/services", input);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.list() });
      await queryClient.invalidateQueries({ queryKey: providerKeys.all() });
      await queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useUpdateProviderService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceId, input }: { serviceId: string; input: UpdateServiceInput }) => {
      const { data } = await apiClient.patch<ProviderMyService>(
        `/api/v1/provider/services/${serviceId}`,
        input
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.list() });
      await queryClient.invalidateQueries({ queryKey: providerKeys.all() });
      await queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}
