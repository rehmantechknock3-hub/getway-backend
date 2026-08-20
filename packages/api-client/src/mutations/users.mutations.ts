import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  SavedLocation,
  User,
  UpdateUserProfileInput,
  CustomerOnboarding,
  ProviderAvailabilityDay,
  ProviderOnboarding,
} from "@repo/schemas";

import { apiClient } from "../client";
import { providerKeys } from "../queries/providers.queries";
import { providerMyServicesKeys } from "../queries/provider-my-services.queries";
import { userKeys } from "../queries/users.queries";

export type EnsureProviderListingResult = { created: boolean };

type UploadAvatarUriInput = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

/** Web `File` or React Native `{ uri, … }` payload for multipart upload. */
export type UploadAvatarInput = File | UploadAvatarUriInput;

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
      if (typeof File !== "undefined" && input instanceof File) {
        formData.append("file", input);
      } else {
        const uriInput = input as UploadAvatarUriInput;
        const rawMime = uriInput.mimeType?.trim().toLowerCase() ?? "";
        const type =
          rawMime === "image/jpg" || rawMime === "image/pjpeg" || !rawMime.startsWith("image/")
            ? "image/jpeg"
            : rawMime;
        const name = uriInput.fileName?.includes(".") ? uriInput.fileName : `avatar-${Date.now()}.jpg`;
        formData.append("file", {
          uri: uriInput.uri,
          type,
          name,
        } as never);
      }

      const { data } = await apiClient.post<User>("/api/v1/users/me/avatar/upload", formData, {
        headers: {
          Accept: "application/json",
        },
        timeout: 60_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
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

export function useUpdateProviderAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (days: ProviderAvailabilityDay[]) => {
      const { data } = await apiClient.put<User>("/api/v1/users/me/provider/availability", {
        days,
      });
      return data;
    },
    onSuccess: (data) => {
      refreshMeCache(queryClient, data);
      void queryClient.invalidateQueries({ queryKey: providerKeys.all() });
    },
  });
}
