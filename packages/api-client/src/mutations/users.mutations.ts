import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  SavedLocation,
  User,
  UpdateUserProfileInput,
  CustomerOnboarding,
  ProviderOnboarding,
} from "@repo/schemas";

import { apiClient } from "../client";
import { providerKeys } from "../queries/providers.queries";
import { providerMyServicesKeys } from "../queries/provider-my-services.queries";
import { userKeys } from "../queries/users.queries";

export type EnsureProviderListingResult = { created: boolean };

type UploadAvatarInput = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateUserProfileInput) => {
      const { data } = await apiClient.patch<User>("/api/v1/users/me/profile", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useUpdateSavedLocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (savedLocations: SavedLocation[]) => {
      const { data } = await apiClient.put<User>("/api/v1/users/me/locations", {
        savedLocations,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadAvatarInput) => {
      const formData = new FormData();
      formData.append("file", {
        uri: input.uri,
        type: input.mimeType ?? "image/jpeg",
        name: input.fileName ?? `avatar-${Date.now()}.jpg`,
      } as never);

      const { data } = await apiClient.post<User>("/api/v1/users/me/avatar/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useSubmitCustomerOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CustomerOnboarding) => {
      const { data: response } = await apiClient.put<User>("/api/v1/users/me/onboarding", {
        role: "CUSTOMER",
        data,
      });
      return response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.me() });
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
    },
  });
}

export function useSubmitProviderOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProviderOnboarding) => {
      const { data: response } = await apiClient.put<User>("/api/v1/users/me/onboarding", {
        role: "PROVIDER",
        data,
      });
      return response;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.list() });
      void queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.categories() });
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
      void queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useEnsureProviderListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<EnsureProviderListingResult>(
        "/api/v1/users/me/provider/ensure-listing"
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.me() });
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
      void queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.list() });
    },
  });
}

export function useUpdateProviderPresence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isOnline: boolean) => {
      const { data } = await apiClient.patch<User>("/api/v1/users/me/provider/presence", {
        isOnline,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.me() });
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
    },
  });
}
