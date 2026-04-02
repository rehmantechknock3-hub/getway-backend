import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  SavedLocation,
  User,
  UpdateUserProfileInput,
  CustomerOnboarding,
  ProviderOnboarding,
} from "@repo/schemas";
import { apiClient } from "../client";
import { userKeys } from "../queries/users.queries";

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
  return useMutation({
    mutationFn: async (data: CustomerOnboarding) => {
      const { data: response } = await apiClient.put<User>("/api/v1/users/me/onboarding", {
        role: "CUSTOMER",
        data,
      });
      return response;
    },
  });
}

export function useSubmitProviderOnboarding() {
  return useMutation({
    mutationFn: async (data: ProviderOnboarding) => {
      const { data: response } = await apiClient.put<User>("/api/v1/users/me/onboarding", {
        role: "PROVIDER",
        data,
      });
      return response;
    },
  });
}
