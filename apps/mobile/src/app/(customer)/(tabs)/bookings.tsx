import { useCallback, useMemo, useState } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import type { BookingWithReview } from "@repo/schemas";
import { useBookings } from "@repo/api-client";

import { BookingStatusProgressDots } from "../../../components/BookingStatusTimeline";
import { appColors } from "../../../styles/colors";

type BookingFilter = "all" | "pending" | "active" | "completed";

function bookingMatchesFilter(status: BookingWithReview["status"], filter: BookingFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return status === "PENDING";
  if (filter === "active") return status === "ACCEPTED" || status === "IN_PROGRESS";
  return status === "COMPLETED";
}

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d instanceof Date ? d : new Date(d));
}

function formatMoney(n: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function statusBadgeClasses(status: BookingWithReview["status"]): { box: string; text: string; label: string } {
  switch (status) {
    case "PENDING":
      return { box: "bg-canvas-sunken", text: "text-ink-soft", label: "Pending" };
    case "ACCEPTED":
      return { box: "bg-primary-50", text: "text-primary-700", label: "Accepted" };
    case "IN_PROGRESS":
      return { box: "bg-primary-100", text: "text-primary-800", label: "In progress" };
    case "COMPLETED":
      return { box: "bg-primary-50", text: "text-primary-700", label: "Completed" };
    case "REJECTED":
      return { box: "bg-canvas-sunken", text: "text-ink", label: "Declined" };
    case "CANCELLED":
      return { box: "bg-ink-faint", text: "text-ink-muted", label: "Cancelled" };
    default:
      return { box: "bg-ink-faint", text: "text-ink-muted", label: status };
  }
}

function FilterChip({
  label,
  count,
  icon,
  iconColor,
  selected,
  onPress,
}: {
  label: string;
  count: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className={`min-w-0 flex-1 items-center gap-1 rounded-2xl border px-3 py-3 ${
        selected ? "border-primary-600 bg-primary-50" : "border-ink-faint bg-canvas-raised"
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count}. Filter bookings.`}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
        {count}
      </Text>
      <Text
        className={`text-center text-xs ${selected ? "font-semibold text-primary-700" : "text-ink-subtle"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [filter, setFilter] = useState<BookingFilter>("all");

  const enabled = isLoaded && isSignedIn;
  const { data, isLoading, isError, refetch, isRefetching } = useBookings(1, { enabled });

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch])
  );

  const bookings = data?.data ?? [];
  const counts = useMemo(() => {
    let pending = 0;
    let active = 0;
    let completed = 0;
    for (const booking of bookings) {
      if (booking.status === "PENDING") pending += 1;
      else if (booking.status === "ACCEPTED" || booking.status === "IN_PROGRESS") active += 1;
      else if (booking.status === "COMPLETED") completed += 1;
    }
    return { all: bookings.length, pending, active, completed };
  }, [bookings]);

  const filtered = useMemo(
    () => bookings.filter((booking) => bookingMatchesFilter(booking.status, filter)),
    [bookings, filter]
  );

  const chipCount = (n: number) => (enabled && !isLoading ? String(n) : "—");
  const listTitle =
    filter === "pending"
      ? "Pending"
      : filter === "active"
        ? "Active"
        : filter === "completed"
          ? "Completed"
          : "Your schedule";
  const emptyTitle =
    filter === "pending"
      ? "No pending bookings"
      : filter === "active"
        ? "No active bookings"
        : filter === "completed"
          ? "No completed bookings"
          : "No bookings yet";
  const emptyBody =
    filter === "pending"
      ? "Requests waiting for the provider to accept will show up here."
      : filter === "active"
        ? "Accepted and in-progress appointments will show up here."
        : filter === "completed"
          ? "Finished appointments will show up here after a job is complete."
          : "Discover a provider, pick a service, and confirm a time — your schedule will show up here.";

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom + 100, 120),
        }}
        refreshControl={
          <RefreshControl refreshing={enabled && isRefetching} onRefresh={() => void refetch()} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-1 text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
          My bookings
        </Text>
        <Text className="mb-6 text-sm text-ink-muted">
          Tap a booking to track status from request to completion.
        </Text>

        <View className="mb-6 flex-row gap-2">
          <FilterChip
            label="All"
            count={chipCount(counts.all)}
            icon="layers-outline"
            iconColor={appColors.primary[600]}
            selected={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterChip
            label="Pending"
            count={chipCount(counts.pending)}
            icon="time-outline"
            iconColor={appColors.semantic.warning}
            selected={filter === "pending"}
            onPress={() => setFilter("pending")}
          />
          <FilterChip
            label="Active"
            count={chipCount(counts.active)}
            icon="briefcase-outline"
            iconColor={appColors.semantic.info}
            selected={filter === "active"}
            onPress={() => setFilter("active")}
          />
          <FilterChip
            label="Completed"
            count={chipCount(counts.completed)}
            icon="checkmark-circle-outline"
            iconColor={appColors.semantic.success}
            selected={filter === "completed"}
            onPress={() => setFilter("completed")}
          />
        </View>

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-ink">{listTitle}</Text>
          <View className="rounded-full bg-primary-50 px-2.5 py-1">
            <Text className="text-xs font-bold text-primary-700">
              {filtered.length} booking{filtered.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {!enabled || isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={appColors.primary[600]} />
          </View>
        ) : isError ? (
          <View className="rounded-2xl border border-ink-faint bg-canvas-raised p-6">
            <Text className="mb-2 text-center font-medium text-ink">Could not load bookings</Text>
            <Text className="text-center text-sm text-ink-muted">
              Pull to refresh, or confirm you are signed in and the API is reachable.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="items-center rounded-2xl border border-ink-faint bg-canvas-raised p-10">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
              <Ionicons name="calendar-outline" size={30} color={appColors.primary[600]} />
            </View>
            <Text className="mb-2 text-center text-lg font-bold text-ink">{emptyTitle}</Text>
            <Text className="text-center text-sm leading-5 text-ink-muted">{emptyBody}</Text>
          </View>
        ) : (
          <View className="gap-3">
            {filtered.map((b) => {
              const badge = statusBadgeClasses(b.status);
              return (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.92}
                  className="rounded-2xl border border-ink-faint bg-canvas-raised p-4"
                  onPress={() =>
                    router.push({
                      pathname: "/(customer)/booking/[bookingId]",
                      params: { bookingId: b.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${b.serviceTitle}, ${formatWhen(b.scheduledAt)}, ${badge.label}. Tap to track status.`}
                >
                  <View className="mb-2 flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-ink" numberOfLines={1}>
                        {b.serviceTitle}
                      </Text>
                      <Text className="mt-0.5 text-sm text-ink-muted">{formatWhen(b.scheduledAt)}</Text>
                    </View>
                    <View className={`rounded-full px-3 py-1 ${badge.box}`}>
                      <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
                    </View>
                  </View>
                  <BookingStatusProgressDots status={b.status} />
                  <View className="mb-2 mt-3 flex-row items-start gap-2">
                    <Ionicons name="location-outline" size={18} color={appColors.primary[600]} />
                    <Text className="flex-1 text-sm leading-5 text-ink-soft">{b.address}</Text>
                  </View>
                  {b.notes ? (
                    <Text className="mb-3 text-xs italic leading-4 text-ink-muted">
                      &ldquo;{b.notes}&rdquo;
                    </Text>
                  ) : null}
                  <View className="mt-1 flex-row items-center justify-between border-t border-ink-faint pt-3">
                    <Text className="text-xs text-ink-subtle">Total</Text>
                    <Text className="text-lg font-bold text-primary-600">
                      {formatMoney(b.totalAmount, b.totalCurrency)}
                    </Text>
                  </View>
                  <View className="mt-2 flex-row items-center justify-end gap-1">
                    <Text className="text-xs font-semibold text-primary-600">View appointment</Text>
                    <Ionicons name="chevron-forward" size={14} color={appColors.primary[600]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
