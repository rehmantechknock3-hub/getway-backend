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

function refreshMeCache(queryClient: ReturnType<typeof useQueryClient>, user?: User) {
  if (user) {
    queryClient.setQueriesData<User>({ queryKey: userKeys.meRoot }, user);
  }
  void queryClient.invalidateQueries({ queryKey: userKeys.meRoot });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateUserProfileInput) => {
      const { data } = await apiClient.patch<User>("/api/v1/users/me/profile", input);
      return data;
    },
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
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
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
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
        // Let the runtime attach multipart boundary (do not keep default application/json).
        headers: { "Content-Type": undefined as unknown as string },
        timeout: 60_000,
      });
      return data;
    },
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
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
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
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
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.list() });
      void queryClient.invalidateQueries({ queryKey: providerMyServicesKeys.categories() });
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
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
      void queryClient.invalidateQueries({ queryKey: userKeys.meRoot });
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
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
    },
  });
}
