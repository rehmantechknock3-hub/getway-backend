import { useCallback, useEffect, useState } from "react";

import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import { setAuthToken, useProviderBooking } from "@repo/api-client";

import { BookingStatusTimeline } from "../../../components/BookingStatusTimeline";
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

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Awaiting your response";
    case "ACCEPTED":
      return "Accepted — scheduled";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Declined";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export default function ProviderBookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = typeof id === "string" ? id : "";
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

  const enabled = isLoaded && isSignedIn && apiReady && !!bookingId;
  const { data: booking, isLoading, isError, refetch } = useProviderBooking(bookingId, { enabled });

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch])
  );

  const customerName = booking
    ? `${booking.customerFirstName} ${booking.customerLastName}`.trim()
    : "";

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom + 28, 40),
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-2xl font-bold text-ink mb-1" style={{ letterSpacing: -0.5 }}>
        Job details
      </Text>
      {booking ? (
        <Text className="text-ink-muted text-sm mb-6">{statusLabel(booking.status)}</Text>
      ) : (
        <View className="mb-6 h-[18px]" />
      )}

      {!enabled || isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : isError || !booking ? (
        <View className="bg-canvas-raised rounded-2xl p-6 border border-ink-faint">
          <Text className="text-ink text-center font-medium">
            Could not load this booking. It may have been removed or you may not have access.
          </Text>
        </View>
      ) : (
        <>
          <BookingStatusTimeline status={booking.status} audience="provider" />

          <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4 mt-4">
            <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">Service</Text>
            <Text className="text-ink font-bold text-lg">{booking.serviceTitle}</Text>
            <View className="flex-row items-center gap-2 mt-3">
              <Ionicons name="person-outline" size={18} color={appColors.ink.muted} />
              <Text className="text-ink-soft text-sm flex-1">{customerName || "Customer"}</Text>
            </View>
            <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2 mt-4">
              Scheduled time
            </Text>
            <Text className="text-ink font-bold text-base">{formatWhen(booking.scheduledAt)}</Text>
            <View className="flex-row items-start gap-2 mt-4">
              <Ionicons name="location-outline" size={20} color={appColors.ink.muted} />
              <Text className="text-ink-soft text-sm flex-1 leading-5">{booking.address}</Text>
            </View>
            {booking.notes ? (
              <Text className="text-ink-muted text-sm mt-3 leading-5 italic">&ldquo;{booking.notes}&rdquo;</Text>
            ) : null}
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-ink-faint">
              <Text className="text-ink-subtle text-sm">Total</Text>
              <Text className="text-primary-600 font-bold text-xl">{formatMoney(booking.totalAmount)}</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
