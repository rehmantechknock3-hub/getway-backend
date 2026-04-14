import { useCallback, useEffect, useState } from "react";

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

import type { Booking } from "@repo/schemas";
import { setAuthToken, useBookings } from "@repo/api-client";
import { appColors } from "../../../styles/colors";

import { BookingStatusProgressDots } from "../../../components/BookingStatusTimeline";

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

function statusBadgeClasses(status: Booking["status"]): { box: string; text: string; label: string } {
  switch (status) {
    case "PENDING":
      return { box: "bg-amber-100", text: "text-amber-900", label: "Pending" };
    case "ACCEPTED":
      return { box: "bg-primary-50", text: "text-primary-800", label: "Accepted" };
    case "IN_PROGRESS":
      return { box: "bg-blue-100", text: "text-blue-900", label: "In progress" };
    case "COMPLETED":
      return { box: "bg-green-100", text: "text-green-900", label: "Completed" };
    case "REJECTED":
      return { box: "bg-red-100", text: "text-red-900", label: "Declined" };
    case "CANCELLED":
      return { box: "bg-ink-faint", text: "text-ink-muted", label: "Cancelled" };
    default:
      return { box: "bg-ink-faint", text: "text-ink-muted", label: status };
  }
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
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
  const { data, isLoading, isError, refetch, isRefetching } = useBookings(1, { enabled });

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch])
  );

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
        <Text className="text-2xl font-bold text-ink mb-1" style={{ letterSpacing: -0.5 }}>
          My bookings
        </Text>
        <Text className="text-ink-muted text-sm mb-8">
          Your booking history — tap a booking to track status from request to completion.
        </Text>

        {!enabled || isLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator />
          </View>
        ) : isError ? (
          <View className="bg-canvas-raised rounded-3xl p-6 border border-ink-faint">
            <Text className="text-ink text-center font-medium mb-2">Could not load bookings</Text>
            <Text className="text-ink-muted text-sm text-center">
              Pull to refresh, or confirm you are signed in as a customer and the API is reachable.
            </Text>
          </View>
        ) : !data?.data.length ? (
          <View className="bg-canvas-raised rounded-3xl p-10 border border-ink-faint items-center">
            <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="calendar-outline" size={30} color={appColors.primary[600]} />
            </View>
            <Text className="text-ink font-bold text-lg text-center mb-2">No bookings yet</Text>
            <Text className="text-ink-muted text-sm text-center leading-5">
              Discover a provider, pick a service, and confirm a time — your schedule will show up here.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {data.data.map((b) => {
              const badge = statusBadgeClasses(b.status);
              return (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.92}
                  className="bg-canvas-raised rounded-3xl p-5 border border-ink-faint shadow-sm"
                  onPress={() => router.push(`/(customer)/booking/${b.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Booking ${formatWhen(b.scheduledAt)}, ${badge.label}. Tap to track status.`}
                >
                  <View className="flex-row items-start justify-between gap-3 mb-2">
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">
                        Scheduled
                      </Text>
                      <Text className="text-ink font-bold text-base">{formatWhen(b.scheduledAt)}</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full ${badge.box}`}>
                      <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
                    </View>
                  </View>
                  <BookingStatusProgressDots status={b.status} />
                  <View className="flex-row items-start gap-2 mb-2 mt-3">
                    <Ionicons name="location-outline" size={18} color={appColors.ink.muted} />
                    <Text className="text-ink-soft text-sm flex-1 leading-5">{b.address}</Text>
                  </View>
                  {b.notes ? (
                    <Text className="text-ink-muted text-xs leading-4 mb-3 italic">&ldquo;{b.notes}&rdquo;</Text>
                  ) : null}
                  <View className="flex-row items-center justify-between pt-3 border-t border-ink-faint">
                    <Text className="text-ink-subtle text-xs">Total</Text>
                    <Text className="text-primary-600 font-bold text-lg">
                      {formatMoney(b.totalAmount, b.totalCurrency)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-end gap-1 mt-2">
                    <Text className="text-primary-600 text-xs font-semibold">Track status</Text>
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
