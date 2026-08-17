import { useCallback, useEffect, useMemo, useState } from "react";

import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchPlaceDetails,
  fetchReverseGeocode,
  useMe,
  usePlacesAutocomplete,
  useUpdateSavedLocations,
} from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { LocationPreviewMap } from "../../components/LocationPreviewMap";
import { SavedLocationsInfoButton } from "../../components/SavedLocationsInfoButton";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";
import { requestDeviceLocation } from "../../utils/device-location";

const MAX_SAVED_LOCATIONS = 10;

type SavedPlace = {
  id: string;
  label: string;
  address: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

export default function CustomerSavedLocationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const updateSavedLocations = useUpdateSavedLocations();

  const [savedLocations, setSavedLocations] = useState<SavedPlace[]>([]);
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftPlaceId, setDraftPlaceId] = useState<string | undefined>(undefined);
  const [draftCoords, setDraftCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);

  useEffect(() => {
    if (!me) return;
    setSavedLocations(
      (me.savedLocations ?? []).map((location, index) => ({
        id: `existing-${index}`,
        label: location.label,
        address: location.address,
        placeId: location.placeId,
        latitude: location.latitude,
        longitude: location.longitude,
      }))
    );
  }, [me]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const placesQuery = usePlacesAutocomplete(debouncedSearch, {
    enabled: debouncedSearch.length >= 2 && debouncedSearch !== draftAddress,
  });

  const centerMap = useCallback((coords: { latitude: number; longitude: number }) => {
    setMapCenter(coords);
    setMapEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await requestDeviceLocation({
        context: { screen: "CustomerSavedLocations", action: "centerMap" },
      });
      if (!result.ok) return;
      setMapCenter({
        latitude: result.data.coords.latitude,
        longitude: result.data.coords.longitude,
      });
      setMapEpoch((n) => n + 1);
    })();
  }, []);

  async function applyPlace(placeId: string) {
    setResolving(true);
    try {
      const details = await fetchPlaceDetails(placeId);
      setDraftAddress(details.address);
      setDraftPlaceId(details.placeId);
      setDraftCoords({ latitude: details.latitude, longitude: details.longitude });
      setSearch(details.address);
      centerMap({ latitude: details.latitude, longitude: details.longitude });
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerSavedLocations", action: "applyPlace" });
      showToast("error", "Could not load that place. Try another search result.");
    } finally {
      setResolving(false);
    }
  }

  async function applyMapTap(coords: { latitude: number; longitude: number }) {
    setResolving(true);
    setDraftCoords(coords);
    try {
      const result = await fetchReverseGeocode(coords.latitude, coords.longitude);
      setDraftAddress(result.address);
      setDraftPlaceId(undefined);
      setSearch(result.address);
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerSavedLocations", action: "applyMapTap" });
      setDraftAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      setDraftPlaceId(undefined);
      showToast("info", "Pinned the map. Address lookup failed — you can still save this pin.");
    } finally {
      setResolving(false);
    }
  }

  async function useCurrentLocation() {
    setLocationDetecting(true);
    try {
      const result = await requestDeviceLocation({
        context: { screen: "CustomerSavedLocations", action: "useCurrentLocation" },
      });
      if (!result.ok) {
        showToast(
          "info",
          result.reason === "denied"
            ? "Location permission denied. Search or tap the map instead."
            : "Could not read your location. Search or tap the map instead."
        );
        return;
      }
      const coords = {
        latitude: result.data.coords.latitude,
        longitude: result.data.coords.longitude,
      };
      setDraftAddress(result.data.addressLabel);
      setDraftPlaceId(undefined);
      setDraftCoords(coords);
      setSearch(result.data.addressLabel);
      centerMap(coords);
    } finally {
      setLocationDetecting(false);
    }
  }

  function addLocation() {
    const trimmedLabel = label.trim();
    const trimmedAddress = draftAddress.trim();
    if (!trimmedLabel) {
      showToast("error", "Add a label", "Use something like Home or Office.");
      return;
    }
    if (!trimmedAddress || !draftCoords) {
      showToast("error", "Pick a place", "Search, use GPS, or tap the map to set the pin.");
      return;
    }
    if (savedLocations.length >= MAX_SAVED_LOCATIONS) {
      showToast("error", `You can save up to ${MAX_SAVED_LOCATIONS} locations.`);
      return;
    }
    const duplicate = savedLocations.some(
      (location) => location.address.toLowerCase() === trimmedAddress.toLowerCase()
    );
    if (duplicate) {
      showToast("info", "That address is already saved.");
      return;
    }
    setSavedLocations((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        label: trimmedLabel,
        address: trimmedAddress,
        placeId: draftPlaceId,
        latitude: draftCoords.latitude,
        longitude: draftCoords.longitude,
      },
    ]);
    setLabel("");
    setSearch("");
    setDraftAddress("");
    setDraftPlaceId(undefined);
    setDraftCoords(null);
  }

  function updateLabel(index: number, value: string) {
    setSavedLocations((prev) =>
      prev.map((location, i) => (i === index ? { ...location, label: value } : location))
    );
  }

  function removeLocation(index: number) {
    setSavedLocations((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveLocations() {
    const cleanLocations = savedLocations
      .map((location) => ({
        label: location.label.trim(),
        address: location.address.trim(),
        placeId: location.placeId,
        latitude: location.latitude,
        longitude: location.longitude,
      }))
      .filter((location) => location.label && location.address);
    try {
      await updateSavedLocations.mutateAsync(cleanLocations);
      showToast("success", "Locations updated successfully.");
      router.back();
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerSavedLocations", action: "handleSaveLocations" });
      showToast("error", error instanceof Error ? error.message : "Failed to save locations");
    }
  }

  const mapMarkers = useMemo(() => {
    const pins: Array<{ id: string; latitude: number; longitude: number }> = [];
    if (draftCoords) {
      pins.push({ id: "draft", latitude: draftCoords.latitude, longitude: draftCoords.longitude });
    }
    for (const location of savedLocations) {
      if (typeof location.latitude === "number" && typeof location.longitude === "number") {
        pins.push({
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    }
    return pins;
  }, [draftCoords, savedLocations]);

  const suggestions = placesQuery.data?.predictions ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas px-5"
      contentContainerStyle={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom + 20, 32) }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center gap-2 mb-4">
        <Text className="text-lg font-bold text-ink">Add a place</Text>
        <SavedLocationsInfoButton />
      </View>

      <Text className="text-ink text-sm font-medium mb-2">Label</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
        placeholder="Home, Office, …"
        placeholderTextColor={appColors.ink.subtle}
        style={textInputBaselineStyle}
        value={label}
        onChangeText={setLabel}
      />

      <Text className="text-ink text-sm font-medium mb-2">Search location</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-2"
        placeholder="Search an address or place"
        placeholderTextColor={appColors.ink.subtle}
        style={textInputBaselineStyle}
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setDraftPlaceId(undefined);
        }}
      />

      <TouchableOpacity
        className="self-start flex-row items-center gap-2 mb-3"
        onPress={() => void useCurrentLocation()}
        disabled={locationDetecting}
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
      >
        {locationDetecting ? (
          <ActivityIndicator size="small" color={appColors.primary[600]} />
        ) : (
          <Ionicons name="locate-outline" size={16} color={appColors.primary[600]} />
        )}
        <Text className="text-primary-600 text-sm font-semibold">
          {locationDetecting ? "Detecting location…" : "Use my current location"}
        </Text>
      </TouchableOpacity>

      {placesQuery.isFetching || resolving ? (
        <View className="py-2 mb-2">
          <ActivityIndicator size="small" color={appColors.primary[600]} />
        </View>
      ) : null}

      {suggestions.length > 0 ? (
        <View className="bg-canvas-raised border border-ink-faint rounded-2xl mb-3 overflow-hidden">
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              className="px-4 py-3 border-b border-ink-faint"
              onPress={() => void applyPlace(item.placeId)}
            >
              <Text className="text-ink text-sm">{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <LocationPreviewMap
        title="Map"
        description="Search a place, use GPS, or tap the map to drop a pin."
        latitude={draftCoords?.latitude ?? mapCenter?.latitude}
        longitude={draftCoords?.longitude ?? mapCenter?.longitude}
        markers={mapMarkers}
        isLoading={resolving}
        emptyMessage="Search, use GPS, or tap the map to choose a place."
        onSelectCoordinate={(coords) => void applyMapTap(coords)}
        recenterKey={mapEpoch}
      />

      {draftAddress ? (
        <Text className="text-ink-muted text-xs mb-3 leading-5">{draftAddress}</Text>
      ) : null}

      <TouchableOpacity
        className="bg-primary-50 border border-primary-100 rounded-2xl py-3 items-center mb-6"
        onPress={addLocation}
        accessibilityRole="button"
        accessibilityLabel="Add this location"
      >
        <Text className="text-primary-600 font-semibold">Add this location</Text>
      </TouchableOpacity>

      <Text className="text-lg font-bold text-ink mb-3">Saved places</Text>
      {savedLocations.length === 0 ? (
        <View className="border border-dashed border-ink-faint rounded-2xl p-4 mb-4">
          <Text className="text-ink-muted text-sm leading-5">
            None yet. Pin a place above, then add it here.
          </Text>
        </View>
      ) : (
        <View className="gap-3 mb-4">
          {savedLocations.map((location, index) => (
            <View key={`${location.id}-${index}`} className="bg-canvas-raised border border-ink-faint rounded-2xl p-3.5">
              <TextInput
                className="bg-canvas border border-ink-faint rounded-xl px-3 py-2.5 text-ink text-sm mb-2"
                placeholder="Label (Home, Office)"
                placeholderTextColor={appColors.ink.subtle}
                style={textInputBaselineStyle}
                value={location.label}
                onChangeText={(value) => updateLabel(index, value)}
              />
              <Text className="text-ink-muted text-sm mb-2.5 leading-5">{location.address}</Text>
              <TouchableOpacity onPress={() => removeLocation(index)} className="self-start">
                <Text className="text-destructive font-medium">Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        className="bg-primary-600 rounded-2xl py-3.5 items-center"
        onPress={() => void handleSaveLocations()}
        disabled={updateSavedLocations.isPending}
        style={{ opacity: updateSavedLocations.isPending ? 0.6 : 1 }}
        accessibilityRole="button"
        accessibilityLabel="Save locations"
      >
        {updateSavedLocations.isPending ? (
          <ActivityIndicator color={appColors.onPrimary} />
        ) : (
          <Text className="text-white font-semibold">Save Locations</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
