import { useEffect } from "react";

import { Linking, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { useQuery } from "@tanstack/react-query";

import { apiClient, mapsKeys } from "@repo/api-client";
import { DrivingRouteResponseSchema, type DrivingRouteResponse } from "@repo/schemas";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { appColors } from "../styles/colors";

type Point = {
  latitude: number;
  longitude: number;
};

type LiveTrackingMapCardProps = {
  title?: string;
  subtitle?: string;
  customerLocation: Point;
  providerLocation?: Point | null;
  providerLocationIsLive?: boolean;
  isConnected: boolean;
  showNavigationAction?: boolean;
};

const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
const DEFAULT_DELTA = 0.01;
const AVG_PROVIDER_SPEED_KMH = 32;

export function LiveTrackingMapCard({
  title = "Live service tracking",
  subtitle = "Watch your provider progress in real time.",
  customerLocation,
  providerLocation,
  providerLocationIsLive,
  isConnected,
  showNavigationAction = true,
}: LiveTrackingMapCardProps) {
  const hasCustomerLocation =
    Number.isFinite(customerLocation.latitude) &&
    Number.isFinite(customerLocation.longitude);
  const hasProviderLocation =
    providerLocation != null &&
    Number.isFinite(providerLocation.latitude) &&
    Number.isFinite(providerLocation.longitude);
  const providerPoint = hasProviderLocation ? providerLocation : null;
  const isLiveProviderLocation = providerLocationIsLive ?? false;
  const center = providerPoint ?? customerLocation;

  const routeQuery = useQuery({
    queryKey: providerPoint
      ? mapsKeys.drivingRoute({
          originLatitude: providerPoint.latitude,
          originLongitude: providerPoint.longitude,
          destLatitude: customerLocation.latitude,
          destLongitude: customerLocation.longitude,
        })
      : (["maps", "driving-route", "disabled"] as const),
    queryFn: async (): Promise<DrivingRouteResponse> => {
      if (!providerPoint) {
        throw new Error("Driving route requested without provider coordinates");
      }
      const { data } = await apiClient.get<unknown>("/api/v1/maps/driving-route", {
        params: {
          originLatitude: providerPoint.latitude,
          originLongitude: providerPoint.longitude,
          destLatitude: customerLocation.latitude,
          destLongitude: customerLocation.longitude,
        },
      });
      return DrivingRouteResponseSchema.parse(data);
    },
    enabled: providerPoint != null && hasCustomerLocation,
    staleTime: 5_000,
    refetchInterval: isLiveProviderLocation ? 5_000 : false,
  });

  useEffect(() => {
    if (!routeQuery.isError) return;
    reportError(routeQuery.error, {
      screen: "LiveTrackingMapCard",
      action: "fetchDrivingRoute",
    });
  }, [routeQuery.error, routeQuery.isError]);

  const route = routeQuery.data;
  const distanceKm = route?.distanceKm ?? null;
  const roadEtaMinutes =
    route?.durationSeconds != null ? Math.max(1, Math.round(route.durationSeconds / 60)) : null;
  const estimatedEtaMinutes =
    distanceKm != null
      ? Math.max(1, Math.round((distanceKm / AVG_PROVIDER_SPEED_KMH) * 60))
      : null;
  const routePath = route?.path ?? (providerPoint ? [providerPoint, customerLocation] : []);

  const openNavigation = async () => {
    const lat = customerLocation.latitude;
    const lon = customerLocation.longitude;
    const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    const nativeUrl =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`
        : `google.navigation:q=${lat},${lon}&mode=d`;

    try {
      const canUseNative = await Linking.canOpenURL(nativeUrl);
      const targetUrl = canUseNative ? nativeUrl : googleDirectionsUrl;
      await Linking.openURL(targetUrl);
    } catch (error: unknown) {
      reportError(error, {
        screen: "LiveTrackingMapCard",
        action: "openNavigation",
      });
      showToast("error", "Could not open navigation app.");
    }
  };

  return (
    <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4 mt-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-ink font-semibold text-base">{title}</Text>
          <Text className="text-ink-muted text-xs mt-0.5">{subtitle}</Text>
        </View>
        <View
          className={`px-2.5 py-1 rounded-full ${
            isConnected ? "bg-green-100" : "bg-amber-100"
          }`}
        >
          <Text className={`text-xs font-semibold ${isConnected ? "text-green-800" : "text-amber-800"}`}>
            {isConnected ? "Live" : "Connecting"}
          </Text>
        </View>
      </View>

      <View className="h-56 rounded-xl overflow-hidden border border-ink-faint">
        {hasCustomerLocation ? (
          <MapView
            provider={mapProvider}
            style={{ flex: 1, width: "100%" }}
            region={{
              latitude: center.latitude,
              longitude: center.longitude,
              latitudeDelta: DEFAULT_DELTA,
              longitudeDelta: DEFAULT_DELTA,
            }}
          >
            <Marker
              coordinate={customerLocation}
              title="Service destination"
              description="Customer location"
              pinColor={appColors.primary[600]}
            />
            {providerPoint ? (
              <>
                <Polyline
                  coordinates={routePath}
                  strokeColor={appColors.primary[500]}
                  strokeWidth={3}
                />
                <Marker
                  coordinate={providerPoint}
                  title="Provider"
                  description="Current live location"
                  pinColor={appColors.semantic.info}
                />
              </>
            ) : null}
          </MapView>
        ) : (
          <View className="flex-1 items-center justify-center bg-canvas">
            <Text className="text-ink-muted text-sm">Location coordinates unavailable</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center gap-3 mt-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="location" size={14} color={appColors.primary[600]} />
          <Text className="text-ink-muted text-xs">Destination</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="navigate" size={14} color={appColors.semantic.info} />
          <Text className="text-ink-muted text-xs">
            {hasProviderLocation
              ? isLiveProviderLocation
                ? "Provider moving"
                : "Provider last known location"
              : "Waiting for provider location"}
          </Text>
        </View>
      </View>

      {hasProviderLocation ? (
        <View className="flex-row items-center gap-2 mt-3">
          <View className="px-2.5 py-1 rounded-full bg-primary-50">
            <Text className="text-primary-700 text-xs font-semibold">
              {routeQuery.isLoading
                ? "Calculating route…"
                : distanceKm != null
                  ? `${distanceKm.toFixed(1)} km (${
                      route?.kind === "DRIVING"
                        ? isLiveProviderLocation
                          ? "driving"
                          : "driving, last known"
                        : isLiveProviderLocation
                          ? "straight line"
                          : "straight line, last known"
                    })`
                  : "Distance unavailable"}
            </Text>
          </View>
          <View className="px-2.5 py-1 rounded-full bg-canvas">
            <Text className="text-ink-soft text-xs font-semibold">
              {routeQuery.isLoading
                ? "ETA…"
                : roadEtaMinutes != null
                  ? `ETA ${roadEtaMinutes} min`
                  : estimatedEtaMinutes != null
                  ? `ETA ~${estimatedEtaMinutes} min`
                  : "ETA unavailable"}
            </Text>
          </View>
        </View>
      ) : null}

      {showNavigationAction ? (
        <Pressable
          onPress={() => void openNavigation()}
          className="mt-3 rounded-xl bg-primary-600 py-3 px-4 flex-row items-center justify-center gap-2"
          accessibilityRole="button"
          accessibilityLabel="Open turn-by-turn navigation"
        >
          <Ionicons name="navigate" size={16} color={appColors.onPrimary} />
          <Text className="text-white text-sm font-semibold">Open turn-by-turn navigation</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
