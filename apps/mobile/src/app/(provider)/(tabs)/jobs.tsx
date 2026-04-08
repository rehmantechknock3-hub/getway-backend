import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import type { ProviderBookingView } from "@repo/schemas";
import {
  setAuthToken,
  useNotifications,
  useProviderBookings,
  useUpdateProviderBookingStatus,
} from "@repo/api-client";

import { BookingStatusProgressDots } from "../../../components/BookingStatusTimeline";
import { appColors } from "../../../styles/colors";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d instanceof Date ? d : new Date(d));
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function statusBadge(status: ProviderBookingView["status"]): { label: string; bg: string; text: string } {
  switch (status) {
    case "PENDING":
      return { label: "New request", bg: "bg-amber-100", text: "text-amber-800" };
    case "ACCEPTED":
      return { label: "Accepted", bg: "bg-blue-100", text: "text-blue-800" };
    case "IN_PROGRESS":
      return { label: "In progress", bg: "bg-green-100", text: "text-green-800" };
    case "COMPLETED":
      return { label: "Completed", bg: "bg-ink-faint", text: "text-ink-muted" };
    case "REJECTED":
      return { label: "Declined", bg: "bg-red-100", text: "text-red-800" };
    case "CANCELLED":
      return { label: "Cancelled", bg: "bg-ink-faint", text: "text-ink-muted" };
    default:
      return { label: status, bg: "bg-ink-faint", text: "text-ink-muted" };
  }
}

type ProviderJobRowProps = {
  job: ProviderBookingView;
  updatingId: string | null;
  onRunStatus: (bookingId: string, status: ProviderBookingView["status"]) => void;
};

function ProviderJobRow({ job, updatingId, onRunStatus }: ProviderJobRowProps) {
  const cfg = statusBadge(job.status);
  const customerName = `${job.customerFirstName} ${job.customerLastName}`.trim();
  const busy = updatingId === job.id;
  return (
    <View className="bg-canvas-raised rounded-3xl border border-ink-faint overflow-hidden">
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push(`/(provider)/booking/${job.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${job.serviceTitle}, ${customerName}. Tap to track booking status.`}
      >
        <View className="flex-row items-start justify-between p-4 pb-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-ink font-bold text-base">{job.serviceTitle}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 mb-1">
              <Ionicons name="person-outline" size={13} color={appColors.ink.muted} />
              <Text className="text-ink-muted text-sm">{customerName}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="location-outline" size={13} color={appColors.ink.muted} />
              <Text className="text-ink-subtle text-xs flex-1" numberOfLines={2}>
                {job.address}
              </Text>
            </View>
          </View>
          <View className={`px-2.5 py-1 rounded-full ${cfg.bg}`}>
            <Text className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</Text>
          </View>
        </View>
        <BookingStatusProgressDots status={job.status} />
        <View className="h-px bg-ink-faint mx-4 mt-3" />
        <View className="flex-row items-center justify-between px-4 py-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={14} color={appColors.ink.muted} />
            <Text className="text-ink-muted text-xs">
              {formatWhen(job.scheduledAt instanceof Date ? job.scheduledAt : new Date(job.scheduledAt))}
            </Text>
          </View>
          <Text className="text-primary-600 font-bold text-base">{formatMoney(job.totalAmount)}</Text>
        </View>
        <View className="flex-row items-center justify-end gap-1 px-4 pb-3">
          <Text className="text-primary-600 text-xs font-semibold">Track status</Text>
          <Ionicons name="chevron-forward" size={14} color={appColors.primary[600]} />
        </View>
      </TouchableOpacity>

      {job.status === "PENDING" && (
        <View className="flex-row gap-3 px-4 pb-4">
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={busy}
            className="flex-1 border border-ink-faint rounded-xl py-2.5 items-center"
            onPress={() => void onRunStatus(job.id, "REJECTED")}
          >
            <Text className="text-ink-soft font-semibold text-sm">Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={busy}
            className="flex-1 bg-primary-600 rounded-xl py-2.5 items-center"
            onPress={() => void onRunStatus(job.id, "ACCEPTED")}
          >
            <Text className="text-white font-semibold text-sm">{busy ? "…" : "Accept"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {job.status === "ACCEPTED" && (
        <View className="px-4 pb-4">
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={busy}
            className="bg-primary-600 rounded-xl py-2.5 items-center"
            onPress={() => void onRunStatus(job.id, "IN_PROGRESS")}
          >
            <Text className="text-white font-semibold text-sm">{busy ? "Updating…" : "Start job"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {job.status === "IN_PROGRESS" && (
        <View className="px-4 pb-4">
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={busy}
            className="bg-green-700 rounded-xl py-2.5 items-center"
            onPress={() => void onRunStatus(job.id, "COMPLETED")}
          >
            <Text className="text-white font-semibold text-sm">{busy ? "Updating…" : "Mark complete"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const { getToken, isLoaded, isSignedIn, sessionClaims } = useAuth();
  const firstName = (sessionClaims?.firstName as string) ?? "there";
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setApiReady(false);
      return;
    }
    let cancelled = false;
    void getToken().then((token) => {
      if (cancelled) return;
      setAuthToken(token);
      setApiReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const enabled = isLoaded && isSignedIn && apiReady;
  const queueQuery = useProviderBookings(1, { enabled, scope: "queue" });
  const historyQuery = useProviderBookings(1, { enabled, scope: "history" });
  const { data: notificationPayload, refetch: refetchNotifications } = useNotifications(1, { enabled });
  const updateStatus = useUpdateProviderBookingStatus();

  const refetchJobs = useCallback(() => {
    void queueQuery.refetch();
    void historyQuery.refetch();
  }, [queueQuery.refetch, historyQuery.refetch]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void refetchJobs();
      void refetchNotifications();
    }, [enabled, refetchJobs, refetchNotifications])
  );

  const queueBookings = queueQuery.data?.data ?? [];
  const pastBookings = historyQuery.data?.data ?? [];
  const stats = queueQuery.data?.stats;
  const isLoading = queueQuery.isLoading;
  const isError = queueQuery.isError;
  const isRefetching = queueQuery.isRefetching || historyQuery.isRefetching;

  const runStatus = async (bookingId: string, status: ProviderBookingView["status"]) => {
    try {
      await updateStatus.mutateAsync({ bookingId, input: { status } });
    } catch {
      Alert.alert("Could not update", "Check your connection and try again.");
    }
  };

  const updatingId =
    updateStatus.isPending && updateStatus.variables?.bookingId
      ? updateStatus.variables.bookingId
      : null;

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 90, 100),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={enabled && isRefetching} onRefresh={() => void refetchJobs()} />
        }
      >
        <View className="flex-row items-center justify-between px-5 mb-6">
          <View>
            <Text className="text-ink-muted text-sm">Hello,</Text>
            <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {firstName} ⚡
            </Text>
          </View>
          <View className="relative">
            <TouchableOpacity
              className="w-11 h-11 rounded-full bg-canvas-raised border border-ink-faint items-center justify-center"
              onPress={() => router.push("/(provider)/notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color={appColors.ink.DEFAULT} />
            </TouchableOpacity>
            {(notificationPayload?.unreadCount ?? 0) > 0 ? (
              <View className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary-600 items-center justify-center px-1 border border-canvas">
                <Text className="text-white text-xs font-bold">
                  {(notificationPayload?.unreadCount ?? 0) > 9
                    ? "9+"
                    : String(notificationPayload?.unreadCount ?? 0)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row gap-2 px-5 mb-6">
          <View className="flex-1 bg-canvas-raised border border-ink-faint rounded-2xl px-3 py-3 items-center gap-1 min-w-0">
            <Ionicons name="time-outline" size={20} color={appColors.semantic.warning} />
            <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {enabled && !isLoading ? String(stats?.pending ?? 0) : "—"}
            </Text>
            <Text className="text-ink-subtle text-xs text-center">New</Text>
          </View>
          <View className="flex-1 bg-canvas-raised border border-ink-faint rounded-2xl px-3 py-3 items-center gap-1 min-w-0">
            <Ionicons name="briefcase-outline" size={20} color={appColors.semantic.info} />
            <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {enabled && !isLoading ? String(stats?.active ?? 0) : "—"}
            </Text>
            <Text className="text-ink-subtle text-xs text-center">Active</Text>
          </View>
          <View className="flex-1 bg-canvas-raised border border-ink-faint rounded-2xl px-3 py-3 items-center gap-1 min-w-0">
            <Ionicons name="checkmark-circle-outline" size={20} color={appColors.semantic.success} />
            <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {enabled && !isLoading ? String(stats?.completed ?? 0) : "—"}
            </Text>
            <Text className="text-ink-subtle text-xs text-center">Completed</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between px-5 mb-4">
          <Text className="text-lg font-bold text-ink">Job queue</Text>
          <View className="bg-primary-100 px-2.5 py-1 rounded-full">
            <Text className="text-primary-700 text-xs font-bold">
              {queueQuery.data?.total ?? 0} booking{queueQuery.data?.total === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {!enabled || isLoading ? (
          <View className="py-16 items-center px-5">
            <ActivityIndicator />
          </View>
        ) : isError ? (
          <View className="mx-5 bg-canvas-raised rounded-3xl p-6 border border-ink-faint">
            <Text className="text-ink text-center font-medium mb-2">Could not load jobs</Text>
            <Text className="text-ink-muted text-sm text-center">
              Pull to refresh, or confirm you are signed in as a provider and the API is running.
            </Text>
          </View>
        ) : queueBookings.length === 0 ? (
          <View className="mx-5 bg-canvas-raised rounded-3xl p-10 border border-ink-faint items-center">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="calendar-outline" size={30} color={appColors.primary[600]} />
            </View>
            <Text className="text-ink font-bold text-lg text-center mb-2">Nothing in your queue</Text>
            <Text className="text-ink-muted text-sm text-center leading-5">
              New requests and active jobs show here so you can accept, start, and complete work. Completed or declined
              bookings appear below under past bookings.
            </Text>
          </View>
        ) : (
          <View className="px-5 gap-3">
            {queueBookings.map((job) => (
              <ProviderJobRow key={job.id} job={job} updatingId={updatingId} onRunStatus={runStatus} />
            ))}
          </View>
        )}

        {!enabled || isLoading || isError ? null : (
          <View className="mt-8 px-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-ink">Past bookings</Text>
              {historyQuery.data != null ? (
                <View className="bg-ink-faint px-2.5 py-1 rounded-full">
                  <Text className="text-ink-muted text-xs font-semibold">
                    {historyQuery.data.total} total
                  </Text>
                </View>
              ) : null}
            </View>
            {historyQuery.isError ? (
              <Text className="text-ink-muted text-sm text-center py-4">
                Could not load past bookings. Pull to refresh.
              </Text>
            ) : historyQuery.isLoading && !historyQuery.data ? (
              <View className="py-8 items-center">
                <ActivityIndicator />
              </View>
            ) : pastBookings.length === 0 ? (
              <Text className="text-ink-muted text-sm text-center py-2">
                No completed, declined, or cancelled jobs yet.
              </Text>
            ) : (
              <View className="gap-3">
                {pastBookings.map((job) => (
                  <ProviderJobRow key={job.id} job={job} updatingId={updatingId} onRunStatus={runStatus} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
