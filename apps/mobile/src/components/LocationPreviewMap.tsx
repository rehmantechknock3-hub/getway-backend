import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { appColors } from "../styles/colors";

type MapPoint = { latitude: number; longitude: number; id?: string };

type LocationPreviewMapProps = {
  title: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  markers?: MapPoint[];
  isLoading?: boolean;
  emptyMessage: string;
  /** When set, the map is always shown and a tap drops/moves the pin. */
  onSelectCoordinate?: (coords: { latitude: number; longitude: number }) => void;
  /** Remount the map so search/GPS can recenter it. */
  recenterKey?: string | number;
};

const DELTA = 0.01;
const FALLBACK_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

export function LocationPreviewMap({
  title,
  description,
  latitude,
  longitude,
  markers,
  isLoading = false,
  emptyMessage,
  onSelectCoordinate,
  recenterKey,
}: LocationPreviewMapProps) {
  const selectable = Boolean(onSelectCoordinate);
  const markerPoints = (markers ?? []).filter(
    (m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)
  );
  const primaryPoint =
    markerPoints[0] ??
    (typeof latitude === "number" && typeof longitude === "number"
      ? { latitude, longitude, id: "single" }
      : undefined);
  const pins = selectable ? markerPoints : markerPoints.length > 0 ? markerPoints : primaryPoint ? [primaryPoint] : [];
  const region: Region | undefined =
    pins[0] != null
      ? {
          latitude: pins[0].latitude,
          longitude: pins[0].longitude,
          latitudeDelta: DELTA,
          longitudeDelta: DELTA,
        }
      : typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA }
        : selectable
          ? FALLBACK_REGION
          : undefined;
  const showMap = selectable || Boolean(region);

  return (
    <View className="bg-canvas border border-ink-faint rounded-2xl p-3 mb-4">
      <Text className="text-ink text-sm font-semibold">{title}</Text>
      {description ? <Text className="text-ink-muted text-xs mt-1 mb-2">{description}</Text> : null}
      <View
        className={`rounded-xl overflow-hidden border border-ink-faint bg-canvas-raised items-center justify-center ${
          selectable ? "h-64" : "h-44"
        }`}
      >
        {showMap && region ? (
          <MapView
            key={recenterKey != null ? String(recenterKey) : undefined}
            provider={mapProvider}
            style={{ flex: 1, width: "100%" }}
            initialRegion={region}
            region={selectable ? undefined : region}
            onPress={
              onSelectCoordinate
                ? (event) => {
                    const coordinate = event.nativeEvent.coordinate;
                    onSelectCoordinate({
                      latitude: coordinate.latitude,
                      longitude: coordinate.longitude,
                    });
                  }
                : undefined
            }
          >
            {pins.map((point, index) => (
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
