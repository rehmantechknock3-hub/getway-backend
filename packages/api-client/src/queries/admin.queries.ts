import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminProviderDetail,
  AdminProviderListResponse,
  AdminProviderRow,
  AdminServiceListResponse,
  AdminServiceRow,
  AdminStats,
  AdminUpdateProviderVerificationInput,
  AdminUpdateServiceActiveInput,
  AdminUserDetail,
  AdminUserListResponse,
  UserRole,
  VerificationStatus,
} from "@repo/schemas";

import { apiClient } from "../client";

export const adminKeys = {
  all: () => ["admin"] as const,
  stats: () => ["admin", "stats"] as const,
  users: (page: number, role?: UserRole, search = "") =>
    ["admin", "users", page, role ?? "ALL", search] as const,
  user: (id: string) => ["admin", "users", "detail", id] as const,
  services: (page: number, search = "", active: "ALL" | "true" | "false" = "ALL") =>
    ["admin", "services", page, search, active] as const,
  providers: (page: number, status?: VerificationStatus) =>
    ["admin", "providers", page, status ?? "ALL"] as const,
  provider: (id: string) => ["admin", "providers", "detail", id] as const,
};

export function useAdminStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const { data } = await apiClient.get<AdminStats>("/api/v1/admin/stats");
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAdminUsers(
  page = 1,
  role?: UserRole,
  options?: { enabled?: boolean; search?: string; limit?: number },
) {
  const search = options?.search?.trim() ?? "";
  const limit = options?.limit ?? 20;
  return useQuery({
    queryKey: [...adminKeys.users(page, role, search), limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (role) params.set("role", role);
      if (search) params.set("q", search);
      const { data } = await apiClient.get<AdminUserListResponse>(
        `/api/v1/admin/users?${params.toString()}`,
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAdminUser(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminKeys.user(userId),
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUserDetail>(
        `/api/v1/admin/users/${userId}`,
      );
      return data;
    },
    enabled: (options?.enabled ?? true) && Boolean(userId),
  });
}

export function useAdminServices(
  page = 1,
  options?: {
    enabled?: boolean;
    search?: string;
    limit?: number;
    active?: boolean;
  },
) {
  const search = options?.search?.trim() ?? "";
  const limit = options?.limit ?? 20;
  const activeKey =
    options?.active === undefined ? "ALL" : options.active ? "true" : "false";
  return useQuery({
    queryKey: [...adminKeys.services(page, search, activeKey), limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("q", search);
      if (options?.active !== undefined) {
        params.set("active", String(options.active));
      }
      const { data } = await apiClient.get<AdminServiceListResponse>(
        `/api/v1/admin/services?${params.toString()}`,
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAdminUpdateServiceActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      serviceId: string;
      input: AdminUpdateServiceActiveInput;
    }) => {
      const { data } = await apiClient.patch<AdminServiceRow>(
        `/api/v1/admin/services/${args.serviceId}/active`,
        args.input,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all() });
    },
  });
}

export function useAdminProviders(
  page = 1,
  status?: VerificationStatus,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: adminKeys.providers(page, status),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      const { data } = await apiClient.get<AdminProviderListResponse>(
        `/api/v1/admin/providers?${params.toString()}`,
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useAdminProvider(
  providerId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: adminKeys.provider(providerId),
    queryFn: async () => {
      const { data } = await apiClient.get<AdminProviderDetail>(
        `/api/v1/admin/providers/${providerId}`,
      );
      return data;
    },
    enabled: (options?.enabled ?? true) && Boolean(providerId),
  });
}

export function useAdminUpdateProviderVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      providerId: string;
      input: AdminUpdateProviderVerificationInput;
    }) => {
      const { data } = await apiClient.patch<AdminProviderRow>(
        `/api/v1/admin/providers/${args.providerId}/verification`,
        args.input,
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all() });
      void queryClient.invalidateQueries({
        queryKey: adminKeys.provider(vars.providerId),
      });
    },
  });
}
