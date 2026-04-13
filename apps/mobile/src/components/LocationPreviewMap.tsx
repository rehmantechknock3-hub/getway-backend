import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { appColors } from "../styles/colors";

type LocationPreviewMapProps = {
  title: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  markers?: Array<{ latitude: number; longitude: number; id?: string }>;
  isLoading?: boolean;
  emptyMessage: string;
};

const DELTA = 0.01;
const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

export function LocationPreviewMap({
  title,
  description,
  latitude,
  longitude,
  markers,
  isLoading = false,
  emptyMessage,
}: LocationPreviewMapProps) {
  const markerPoints = (markers ?? []).filter(
    (m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)
  );
  const hasCoords =
    markerPoints.length > 0 || (typeof latitude === "number" && typeof longitude === "number");
  const primaryPoint =
    markerPoints[0] ??
    (typeof latitude === "number" && typeof longitude === "number"
      ? { latitude, longitude, id: "single" }
      : undefined);
  const region: Region | undefined = hasCoords
    ? {
        latitude: primaryPoint?.latitude ?? 0,
        longitude: primaryPoint?.longitude ?? 0,
        latitudeDelta: DELTA,
        longitudeDelta: DELTA,
      }
    : undefined;

  return (
    <View className="bg-canvas border border-ink-faint rounded-2xl p-3 mb-4">
      <Text className="text-ink text-sm font-semibold">{title}</Text>
      {description ? <Text className="text-ink-muted text-xs mt-1 mb-2">{description}</Text> : null}
      <View className="h-44 rounded-xl overflow-hidden border border-ink-faint bg-canvas-raised items-center justify-center">
        {hasCoords && region ? (
          <MapView
            provider={mapProvider}
            style={{ flex: 1, width: "100%" }}
            initialRegion={region}
            region={region}
          >
            {(markerPoints.length > 0
              ? markerPoints
              : primaryPoint
                ? [primaryPoint]
                : []
            ).map((point, index) => (
              <Marker
                key={point.id ?? `${point.latitude}-${point.longitude}-${String(index)}`}
                coordinate={{ latitude: point.latitude, longitude: point.longitude }}
              />
            ))}
          </MapView>
        ) : isLoading ? (
          <ActivityIndicator color={appColors.primary[600]} />
        ) : (
          <Text className="text-ink-muted text-xs px-4 text-center">{emptyMessage}</Text>
        )}
      </View>
    </View>
  );
}
