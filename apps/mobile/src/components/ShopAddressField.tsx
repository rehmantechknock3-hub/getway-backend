import { useCallback, useEffect, useState } from "react";

import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { showToast } from "@repo/ui";
import { fetchGoogleGeocodeLocation, fetchGooglePlaceDetailsLocation } from "@repo/utils";

import { appColors } from "../styles/colors";
import { textInputBaselineStyle } from "../styles/text-input";
import { requestDeviceLocation } from "../utils/device-location";
import { LocationPreviewMap } from "./LocationPreviewMap";

type ShopLocation = { address: string; placeId?: string; latitude?: number; longitude?: number };

type ShopAddressFieldProps = {
  shopAddress: string;
  setShopAddress: (value: string) => void;
  shopPlaceId?: string;
  setShopPlaceId: (value: string | undefined) => void;
  shopLocations: ShopLocation[];
  setShopLocations: (updater: (prev: ShopLocation[]) => ShopLocation[]) => void;
  googleMapsApiKey?: string;
  /** Show a “use current location” control. */
  enableDeviceLocation?: boolean;
  /** Silently detect GPS on mount when the locations list is still empty. */
  autoDetectOnMount?: boolean;
  inputPlaceholder: string;
  mapEmptyMessage: string;
  mapDescription: string;
};

export function ShopAddressField({
  shopAddress,
  setShopAddress,
  shopPlaceId,
  setShopPlaceId,
  shopLocations,
  setShopLocations,
  googleMapsApiKey,
  enableDeviceLocation = false,
  autoDetectOnMount = false,
  inputPlaceholder,
  mapEmptyMessage,
  mapDescription,
}: ShopAddressFieldProps) {
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ description: string; placeId: string }>>(
    []
  );
  const [placesLoading, setPlacesLoading] = useState(false);
  const [previewLatitude, setPreviewLatitude] = useState<number | undefined>(undefined);
  const [previewLongitude, setPreviewLongitude] = useState<number | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [locationFromDevice, setLocationFromDevice] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);

  const detectCurrentLocation = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLocationDetecting(true);
      try {
        const result = await requestDeviceLocation({
          context: { screen: "ShopAddressField", action: "detectCurrentLocation" },
        });
        if (!result.ok) {
          setLocationFromDevice(false);
          if (!opts?.silent) {
            showToast(
              "info",
              result.reason === "denied"
                ? "Location permission denied. Search or type your shop address."
                : "Could not read your location. Search or type your shop address."
            );
          }
          return;
        }
        setLocationFromDevice(true);
        setShopAddress(result.data.addressLabel);
        setShopPlaceId(undefined);
        setPlaceSuggestions([]);
        setPreviewLatitude(result.data.coords.latitude);
        setPreviewLongitude(result.data.coords.longitude);
        // Seed the saved list when empty so Continue/Save works without an extra Add tap.
        // Provider can still edit the text, remove the chip, or search a different address.
        setShopLocations((prev) => {
          if (prev.length > 0) return prev;
          return [
            {
              address: result.data.addressLabel,
              latitude: result.data.coords.latitude,
              longitude: result.data.coords.longitude,
            },
          ];
        });
      } finally {
        setLocationDetecting(false);
      }
    },
    [setShopAddress, setShopPlaceId, setShopLocations]
  );

  useEffect(() => {
    if (!enableDeviceLocation || !autoDetectOnMount) return;
    if (shopLocations.length > 0) return;
    void detectCurrentLocation({ silent: true });
  }, [enableDeviceLocation, autoDetectOnMount, detectCurrentLocation, shopLocations.length]);

  useEffect(() => {
    const q = shopAddress.trim();
    if (!googleMapsApiKey || q.length < 3) {
      setPlaceSuggestions([]);
      return;
    }

    const timeout = setTimeout(() => {
      setPlacesLoading(true);
      void (async () => {
        try {
          const url =
            "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
            `?input=${encodeURIComponent(q)}` +
            "&types=establishment" +
            `&key=${encodeURIComponent(googleMapsApiKey)}`;
          const res = await fetch(url);
          const json = (await res.json()) as {
            status?: string;
            predictions?: Array<{ description?: string; place_id?: string }>;
          };
          if (json.status !== "OK" || !Array.isArray(json.predictions)) {
            setPlaceSuggestions([]);
            return;
          }
          setPlaceSuggestions(
            json.predictions
              .filter(
                (item): item is { description: string; place_id: string } =>
                  typeof item.description === "string" && typeof item.place_id === "string"
              )
              .slice(0, 5)
              .map((item) => ({ description: item.description, placeId: item.place_id }))
          );
        } catch {
          setPlaceSuggestions([]);
        } finally {
          setPlacesLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timeout);
  }, [shopAddress, googleMapsApiKey]);

  useEffect(() => {
    if (locationFromDevice) return;

    const query = shopAddress.trim();
    if (!googleMapsApiKey || query.length < 3) {
      setPreviewLatitude(undefined);
      setPreviewLongitude(undefined);
      setPreviewLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setPreviewLoading(true);
      void (async () => {
        let coords =
          shopPlaceId != null
            ? await fetchGooglePlaceDetailsLocation(shopPlaceId, googleMapsApiKey)
            : null;
        if (!coords) {
          coords = await fetchGoogleGeocodeLocation(query, googleMapsApiKey);
        }
        setPreviewLatitude(coords?.latitude);
        setPreviewLongitude(coords?.longitude);
        setPreviewLoading(false);
      })();
    }, 450);

    return () => clearTimeout(timeout);
  }, [shopAddress, shopPlaceId, googleMapsApiKey, locationFromDevice]);

  const mapMarkers = [
    ...(typeof previewLatitude === "number" && typeof previewLongitude === "number"
      ? [{ id: "draft-input", latitude: previewLatitude, longitude: previewLongitude }]
      : []),
    ...shopLocations
      .filter(
        (location) =>
          typeof location.latitude === "number" && typeof location.longitude === "number"
      )
      .map((location, index) => ({
        id: `${location.placeId ?? location.address}-${String(index)}`,
        latitude: location.latitude as number,
        longitude: location.longitude as number,
      })),
  ];

  function addCurrentDraft() {
    const trimmed = shopAddress.trim();
    if (!trimmed) return;
    setShopLocations((prev) => {
      const duplicate = prev.some(
        (location) => location.address.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) return prev;
      return [
        ...prev,
        {
          address: trimmed,
          placeId: shopPlaceId,
          latitude: previewLatitude,
          longitude: previewLongitude,
        },
      ];
    });
    setShopAddress("");
    setShopPlaceId(undefined);
    setPlaceSuggestions([]);
    setLocationFromDevice(false);
    setPreviewLatitude(undefined);
    setPreviewLongitude(undefined);
  }

  return (
    <>
      <Text className="text-ink text-sm font-medium mb-2">Shop address</Text>
      <View className="flex-row gap-2 items-center mb-2">
        <TextInput
          className="flex-1 bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base"
          placeholder={inputPlaceholder}
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
          value={shopAddress}
          onChangeText={(value) => {
            setShopAddress(value);
            setShopPlaceId(undefined);
            setLocationFromDevice(false);
          }}
        />
        <TouchableOpacity className="bg-primary-600 rounded-xl px-3 py-2.5" onPress={addCurrentDraft}>
          <Text className="text-white text-xs font-semibold">Add</Text>
        </TouchableOpacity>
      </View>
      {enableDeviceLocation ? (
        <TouchableOpacity
          className="self-start flex-row items-center gap-2 mb-3 px-1"
          onPress={() => void detectCurrentLocation()}
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
      ) : null}
      {placesLoading ? (
        <View className="py-2">
          <ActivityIndicator size="small" color={appColors.primary[600]} />
        </View>
      ) : null}
      {placeSuggestions.length > 0 ? (
        <View className="bg-canvas-raised border border-ink-faint rounded-2xl mt-2 mb-3 overflow-hidden">
          {placeSuggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              className="px-4 py-3 border-b border-ink-faint"
              onPress={() => {
                setShopAddress(item.description);
                setShopPlaceId(item.placeId);
                setLocationFromDevice(false);
                setPlaceSuggestions([]);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Use address ${item.description}`}
            >
              <Text className="text-ink text-sm">{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {shopLocations.length > 0 ? (
        <View className="mb-4 gap-2">
          {shopLocations.map((location, index) => (
            <View
              key={`${location.address}-${index}`}
              className="bg-canvas-raised rounded-xl border border-ink-faint px-3 py-2 flex-row items-center justify-between"
            >
              <Text className="text-ink text-xs flex-1 mr-2">{location.address}</Text>
              <TouchableOpacity
                onPress={() =>
                  setShopLocations((prev) =>
                    prev.filter((_, locationIndex) => locationIndex !== index)
                  )
                }
              >
                <Text className="text-red-600 text-xs font-semibold">Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      <LocationPreviewMap
        title="Shop pin preview"
        description={mapDescription}
        markers={mapMarkers}
        isLoading={previewLoading || locationDetecting}
        emptyMessage={mapEmptyMessage}
      />
    </>
  );
}
