import { useCallback, useEffect, useRef, useState } from "react";

import { ActivityIndicator, AppState, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { io, type Socket } from "socket.io-client";
import * as Location from "expo-location";

import { useProviderBooking, useUpdateProviderBookingStatus } from "@repo/api-client";
import { isTerminalBookingStatus, useBookingTracking } from "@repo/hooks";
import type { ProviderBookingView } from "@repo/schemas";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { BookingStatusTimeline } from "../../../components/BookingStatusTimeline";
import { LiveTrackingMapCard } from "../../../components/LiveTrackingMapCard";
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

function formatMoney(n: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Awaiting your response";
    case "ACCEPTED":
      return "On the way";
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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = typeof id === "string" ? id : "";
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const getTokenRef = useRef(getToken);
  const reconnectingRef = useRef(false);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [localProviderLocation, setLocalProviderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [lastLiveProviderLocation, setLastLiveProviderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const enabled = isLoaded && isSignedIn && !!bookingId;
  const { data: booking, isLoading, isError, refetch } = useProviderBooking(bookingId, { enabled });
  const updateStatus = useUpdateProviderBookingStatus();
  const bookingStatus = booking?.status ?? null;
  const shouldConnectSocket =
    enabled && !!bookingId && !isLoading && !!booking && !isTerminalBookingStatus(bookingStatus);
  const tracking = useBookingTracking(
    shouldConnectSocket ? bookingId : null,
    shouldConnectSocket ? socketInstance : null
  );
  const effectiveStatus = tracking.status ?? bookingStatus;
  const statusBusy = updateStatus.isPending;

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!tracking.providerLocation) return;
    setLastLiveProviderLocation({
      latitude: tracking.providerLocation.latitude,
      longitude: tracking.providerLocation.longitude,
    });
  }, [tracking.providerLocation]);

  useEffect(() => {
    setLocalProviderLocation(null);
    setLastLiveProviderLocation(null);
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch])
  );

  useEffect(() => {
    if (!tracking.status || !isTerminalBookingStatus(tracking.status)) return;
    void refetch();
  }, [tracking.status, refetch]);

  useEffect(() => {
    if (!shouldConnectSocket) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      return;
    }

    if (socketRef.current != null) return;

    let cancelled = false;
    const rawBaseUrl =
      process.env.EXPO_PUBLIC_SOCKET_URL ??
      process.env.EXPO_PUBLIC_API_URL ??
      "http://127.0.0.1:3010";
    const normalized = rawBaseUrl.trim().replace(/\/$/, "");
    const client = io(`${normalized}/bookings`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      query: { bookingId },
      auth: (cb) => {
        void getTokenRef.current({ skipCache: true }).then((token) => {
          cb({ token: token ?? "" });
        });
      },
    });
    const reconnectWithFreshToken = () => {
      if (reconnectingRef.current) return;
      reconnectingRef.current = true;
      void getTokenRef.current({ skipCache: true })
        .then((token) => {
          client.auth = { token: token ?? "" };
          if (!client.connected) client.connect();
        })
        .catch((error: unknown) => {
          reportError(error, { screen: "ProviderBookingDetail", action: "socketReconnectToken" });
        })
        .finally(() => {
          reconnectingRef.current = false;
        });
    };

    client.on("connect_error", reconnectWithFreshToken);
    client.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") reconnectWithFreshToken();
    });
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !client.connected) {
        reconnectWithFreshToken();
      }
    });

    if (cancelled) {
      client.disconnect();
      return;
    }
    socketRef.current = client;
    setSocketInstance(client);

    return () => {
      cancelled = true;
      appStateSub.remove();
      client.off("connect_error", reconnectWithFreshToken);
      client.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [shouldConnectSocket, bookingId]);

  useEffect(() => {
    if (!socketInstance || !bookingId) return;
    if (effectiveStatus !== "IN_PROGRESS") return;

    let subscription: Location.LocationSubscription | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let lastEmitAt = 0;
    let mounted = true;

    const emitCurrentLocation = async () => {
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocalProviderLocation(nextLocation);
        const now = Date.now();
        // Keep at least 1.2s gap to align with backend websocket throttle.
        if (now - lastEmitAt < 1_200) return;
        lastEmitAt = now;
        socketInstance.emit("location:broadcast", {
          bookingId,
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        });
      } catch (error: unknown) {
        reportError(error, { screen: "ProviderBookingDetail", action: "emitCurrentLocation" });
      }
    };

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !mounted) return;

      await emitCurrentLocation();

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 1,
          timeInterval: 1_000,
        },
        (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocalProviderLocation(nextLocation);
          const now = Date.now();
          if (now - lastEmitAt < 1_200) return;
          lastEmitAt = now;
          socketInstance.emit("location:broadcast", {
            bookingId,
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
          });
        }
      );

      // Backup heartbeat in case watch callbacks pause after app resume.
      pollInterval = setInterval(() => {
        void emitCurrentLocation();
      }, 4_000);
    })();

    return () => {
      mounted = false;
      subscription?.remove();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [bookingId, effectiveStatus, socketInstance]);

  const customerName = booking
    ? `${booking.customerFirstName} ${booking.customerLastName}`.trim()
    : "";
  const providerDisplayLocation =
    localProviderLocation ?? tracking.providerLocation ?? lastLiveProviderLocation;

  async function runStatus(status: ProviderBookingView["status"]) {
    if (!bookingId || statusBusy) return;
    try {
      await updateStatus.mutateAsync({ bookingId, input: { status } });
      await refetch();
      if (status === "ACCEPTED") {
        showToast("success", "Request accepted");
      } else if (status === "REJECTED") {
        showToast("success", "Request declined");
      } else {
        showToast("success", "Job updated");
      }
    } catch (error: unknown) {
      reportError(error, {
        screen: "ProviderBookingDetail",
        action: "updateStatus",
        extra: { bookingId, status },
      });
      showToast("error", "Could not update", "Check your connection and try again.");
    }
  }

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
        Job
      </Text>
      {booking ? (
        <View className="flex-row items-center gap-2 mb-6">
          <View className="bg-primary-50 rounded-full px-3 py-1">
            <Text className="text-primary-700 text-xs font-semibold">
              {statusLabel(effectiveStatus ?? booking.status)}
            </Text>
          </View>
        </View>
      ) : (
        <View className="mb-6 h-[18px]" />
      )}

      {!enabled || isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator color={appColors.primary[600]} />
        </View>
      ) : isError || !booking ? (
        <View className="bg-canvas-raised rounded-2xl p-6 border border-ink-faint">
          <Text className="text-ink text-center font-medium">
            Could not load this booking. It may have been removed or you may not have access.
          </Text>
        </View>
      ) : (
        <>
          <BookingStatusTimeline status={effectiveStatus ?? booking.status} audience="provider" />

          {effectiveStatus === "IN_PROGRESS" ? (
            <LiveTrackingMapCard
              title="Navigate to customer"
              subtitle="Live navigation is available once the job is started."
              customerLocation={{ latitude: booking.latitude, longitude: booking.longitude }}
              providerLocation={providerDisplayLocation}
              providerLocationIsLive={providerDisplayLocation != null}
              isConnected={tracking.isConnected}
            />
          ) : null}

          <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4 mt-4">
            <Text className="text-xs font-semibold text-primary-600 mb-2">Service</Text>
            <Text className="text-ink font-bold text-lg">{booking.serviceTitle}</Text>
            <View className="flex-row items-center gap-2 mt-3">
              <Ionicons name="person-outline" size={18} color={appColors.primary[600]} />
              <Text className="text-ink-soft text-sm flex-1">{customerName || "Customer"}</Text>
            </View>
            <Text className="text-xs font-semibold text-primary-600 mb-2 mt-4">
              Scheduled time
            </Text>
            <Text className="text-ink font-bold text-base">{formatWhen(booking.scheduledAt)}</Text>
            <View className="flex-row items-start gap-2 mt-4">
              <Ionicons name="location-outline" size={20} color={appColors.primary[600]} />
              <Text className="text-ink-soft text-sm flex-1 leading-5">{booking.address}</Text>
            </View>
            {booking.notes ? (
              <Text className="text-ink-muted text-sm mt-3 leading-5 italic">&ldquo;{booking.notes}&rdquo;</Text>
            ) : null}
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-ink-faint">
              <Text className="text-ink-subtle text-sm">Total</Text>
              <Text className="text-primary-600 font-bold text-xl">
                {formatMoney(booking.totalAmount, booking.totalCurrency)}
              </Text>
            </View>
          </View>

          {effectiveStatus === "PENDING" ? (
            <View className="mt-4">
              <Text className="text-ink-muted text-sm mb-3 leading-5">
                Review this request, then accept to take the job or decline if you cannot do it.
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={statusBusy}
                  className="flex-1 border border-ink-faint rounded-2xl py-3.5 items-center bg-canvas-raised"
                  onPress={() => void runStatus("REJECTED")}
                  accessibilityRole="button"
                  accessibilityLabel="Decline booking request"
                  style={{ opacity: statusBusy ? 0.6 : 1 }}
                >
                  <Text className="text-ink-soft font-semibold text-base">
                    {statusBusy && updateStatus.variables?.input.status === "REJECTED"
                      ? "Declining…"
                      : "Decline"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={statusBusy}
                  className="flex-1 bg-primary-600 rounded-2xl py-3.5 items-center"
                  onPress={() => void runStatus("ACCEPTED")}
                  accessibilityRole="button"
                  accessibilityLabel="Accept booking request"
                  style={{ opacity: statusBusy ? 0.6 : 1 }}
                >
                  {statusBusy && updateStatus.variables?.input.status === "ACCEPTED" ? (
                    <ActivityIndicator color={appColors.onPrimary} />
                  ) : (
                    <Text className="text-white font-semibold text-base">Accept</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {effectiveStatus === "ACCEPTED" ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={statusBusy}
              className="bg-primary-600 rounded-2xl py-3.5 items-center mt-4"
              onPress={() => void runStatus("IN_PROGRESS")}
              accessibilityRole="button"
              accessibilityLabel="Start job"
              style={{ opacity: statusBusy ? 0.6 : 1 }}
            >
              {statusBusy && updateStatus.variables?.input.status === "IN_PROGRESS" ? (
                <ActivityIndicator color={appColors.onPrimary} />
              ) : (
                <Text className="text-white font-semibold text-base">Start job</Text>
              )}
            </TouchableOpacity>
          ) : null}

          {effectiveStatus === "IN_PROGRESS" ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={statusBusy}
              className="bg-primary-600 rounded-2xl py-3.5 items-center mt-4"
              onPress={() => void runStatus("COMPLETED")}
              accessibilityRole="button"
              accessibilityLabel="Mark job complete"
              style={{ opacity: statusBusy ? 0.6 : 1 }}
            >
              {statusBusy && updateStatus.variables?.input.status === "COMPLETED" ? (
                <ActivityIndicator color={appColors.onPrimary} />
              ) : (
                <Text className="text-white font-semibold text-base">Mark complete</Text>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-canvas-raised border border-primary-600 rounded-2xl py-3.5 mt-4"
            onPress={() => router.push(`/(provider)/conversation/new?bookingId=${bookingId}`)}
            accessibilityRole="button"
            accessibilityLabel="Message customer"
          >
            <Ionicons name="chatbubble-outline" size={18} color={appColors.primary[600]} />
            <Text className="text-primary-600 font-semibold text-sm">Message customer</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
