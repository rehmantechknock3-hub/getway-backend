import { useMemo } from "react";

import { ActivityIndicator, Platform, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import type { ProviderPublicSummary } from "@repo/schemas";

import { appColors } from "../../styles/colors";

type NearbyProvidersMapProps = {
  customerCoords: { lat: number; lon: number } | null;
  providers: ProviderPublicSummary[];
  radiusKm: number;
  isLoading?: boolean;
  onSelectProvider?: (providerId: string) => void;
};

const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

/** ~1° latitude ≈ 111 km — pad so a 10 km radius fits with margin. */
function deltaForRadiusKm(radiusKm: number): number {
  return Math.max((radiusKm * 2.4) / 111, 0.04);
}

function providerPin(p: ProviderPublicSummary): { latitude: number; longitude: number } | null {
  const lat = p.nearestLocationLatitude ?? p.latitude;
  const lon = p.nearestLocationLongitude ?? p.longitude;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

export function NearbyProvidersMap({
  customerCoords,
  providers,
  radiusKm,
  isLoading = false,
  onSelectProvider,
}: NearbyProvidersMapProps) {
  const markers = useMemo(
    () =>
      providers
        .map((p) => {
          const pin = providerPin(p);
          if (!pin) return null;
          return {
            id: p.id,
            title: `${p.firstName} ${p.lastName}`.trim(),
            ...pin,
            isOnline: p.isOnline,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m != null),
    [providers]
  );

  const region: Region | undefined = customerCoords
    ? {
        latitude: customerCoords.lat,
        longitude: customerCoords.lon,
        latitudeDelta: deltaForRadiusKm(radiusKm),
        longitudeDelta: deltaForRadiusKm(radiusKm),
      }
    : markers[0]
      ? {
          latitude: markers[0].latitude,
          longitude: markers[0].longitude,
          latitudeDelta: deltaForRadiusKm(radiusKm),
          longitudeDelta: deltaForRadiusKm(radiusKm),
        }
      : undefined;

  return (
    <View className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-white font-semibold text-base">Nearby providers</Text>
          <Text className="text-surface-muted text-xs mt-1">
            Within {radiusKm} km of your location
          </Text>
        </View>
        <View className="bg-surface-elevated rounded-full px-2.5 py-1">
          <Text className="text-glow-blue text-xs font-semibold">{markers.length} on map</Text>
        </View>
      </View>

      <View className="h-56 mx-3 mb-3 rounded-xl overflow-hidden border border-surface-border bg-surface-elevated items-center justify-center">
        {!customerCoords && markers.length === 0 ? (
          isLoading ? (
            <ActivityIndicator color={appColors.glow.blue} />
          ) : (
            <View className="items-center px-6">
              <Ionicons name="location-outline" size={28} color={appColors.surface.muted} />
              <Text className="text-surface-muted text-xs text-center mt-2 leading-5">
                Enable location to see providers near you on the map.
              </Text>
            </View>
          )
        ) : region ? (
          <MapView
            provider={mapProvider}
            style={{ flex: 1, width: "100%" }}
            key={
              customerCoords
                ? `${customerCoords.lat.toFixed(4)}-${customerCoords.lon.toFixed(4)}`
                : "nearby-map"
            }
            initialRegion={region}
          >
            {customerCoords ? (
              <>
                <Marker
                  coordinate={{
                    latitude: customerCoords.lat,
                    longitude: customerCoords.lon,
                  }}
                  title="You"
                  pinColor={appColors.glow.blue}
                />
                <Circle
                  center={{
                    latitude: customerCoords.lat,
                    longitude: customerCoords.lon,
                  }}
                  radius={radiusKm * 1000}
                  strokeColor="rgba(59, 130, 246, 0.55)"
                  fillColor="rgba(59, 130, 246, 0.12)"
                  strokeWidth={1}
                />
              </>
            ) : null}
            {markers.map((m) => (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                title={m.title}
                description={m.isOnline ? "Online" : "Offline"}
                pinColor={m.isOnline ? appColors.semantic.success : appColors.surface.muted}
                onCalloutPress={() => onSelectProvider?.(m.id)}
              />
            ))}
          </MapView>
        ) : (
          <ActivityIndicator color={appColors.glow.blue} />
        )}
      </View>
    </View>
  );
}
