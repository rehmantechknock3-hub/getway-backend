import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import {
  bookingKeys,
  setAuthToken,
  useCreateBooking,
  useProviderServices,
} from "@repo/api-client";

import { textInputBaselineStyle } from "../../../../../styles/text-input";

const DAY_OFFSETS = [1, 2, 3, 5, 7] as const;
const SLOT_LABELS = [
  { label: "Morning", hour: 9 },
  { label: "Midday", hour: 12 },
  { label: "Afternoon", hour: 15 },
  { label: "Evening", hour: 18 },
] as const;

const PLACEHOLDER_MUTED = "#A8A29E";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

function combineDateAndHour(day: Date, hour: number): Date {
  const x = new Date(day);
  x.setHours(hour, 0, 0, 0);
  return x;
}

function formatDayChip(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatSlotSummary(day: Date, hour: number): string {
  const slot = SLOT_LABELS.find((s) => s.hour === hour)?.label ?? `${hour}:00`;
  return `${formatDayChip(day)} · ${slot}`;
}

type Step = 1 | 2 | 3;

export default function BookServiceScreen() {
  const { id, serviceId } = useLocalSearchParams<{ id: string; serviceId: string }>();
  const providerId = typeof id === "string" ? id : id?.[0] ?? "";
  const svcId = typeof serviceId === "string" ? serviceId : serviceId?.[0] ?? "";
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [apiReady, setApiReady] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const today = useMemo(() => startOfDay(new Date()), []);
  const dayOptions = useMemo(
    () => DAY_OFFSETS.map((off) => addDays(today, off)),
    [today]
  );

  const [selectedDay, setSelectedDay] = useState(() => dayOptions[0] ?? addDays(today, 1));
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const servicesQuery = useProviderServices(providerId, {
    enabled: apiReady && !!providerId,
  });
  const createBooking = useCreateBooking();

  const service = useMemo(
    () => servicesQuery.data?.find((s) => s.id === svcId),
    [servicesQuery.data, svcId]
  );

  const scheduledAt = useMemo(
    () => combineDateAndHour(selectedDay, selectedHour),
    [selectedDay, selectedHour]
  );

  const useMyLocation = useCallback(async () => {
    setFormError(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setFormError("Location permission is required to use this option.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      setFormError("Could not read your location. Try again or enter an address.");
    } finally {
      setLocating(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!svcId || !address.trim()) return;
    const lat = coords?.latitude ?? 0;
    const lon = coords?.longitude ?? 0;
    setFormError(null);
    try {
      await createBooking.mutateAsync({
        serviceId: svcId,
        scheduledAt,
        address: address.trim(),
        latitude: lat,
        longitude: lon,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      await queryClient.refetchQueries({ queryKey: bookingKeys.all() });
      Alert.alert(
        "Booking confirmed",
        "Your booking was created successfully. You can review it anytime under My bookings.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(customer)/(tabs)/bookings"),
          },
        ]
      );
    } catch {
      setFormError("Booking failed. Check your connection and try again.");
    }
  }, [svcId, address, coords, scheduledAt, notes, createBooking, queryClient]);

  if (!providerId || !svcId) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink-muted text-center">Missing booking details.</Text>
      </View>
    );
  }

  if (servicesQuery.isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <ActivityIndicator />
        <Text className="text-ink-muted text-sm mt-4 text-center">Loading booking…</Text>
      </View>
    );
  }

  if (servicesQuery.isError) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink text-center font-medium mb-2">Could not load this service</Text>
        <Text className="text-ink-muted text-sm text-center mb-6">
          Check your connection and API settings, then try again.
        </Text>
        <TouchableOpacity
          className="bg-primary-600 rounded-2xl px-6 py-3"
          onPress={() => void servicesQuery.refetch()}
        >
          <Text className="text-white font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!service) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink text-center font-medium">Service not found.</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-primary-600 font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom + 24, 32),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-5 mb-5">
        <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">
          You&apos;re booking
        </Text>
        <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.3 }}>
          {service.title}
        </Text>
        <Text className="text-ink-muted text-sm mt-1">{service.categoryName}</Text>
      </View>

      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-sm font-semibold text-ink-muted">Step {step} of 3</Text>
        <View className="flex-row gap-2">
          {([1, 2, 3] as const).map((s) => (
            <View
              key={s}
              className={`h-2 rounded-full ${s === step ? "bg-primary-600 w-6" : "bg-ink-faint w-2"}`}
            />
          ))}
        </View>
      </View>

      {step === 1 ? (
        <View>
          <Text className="text-lg font-bold text-ink mb-1">When do you want the booking?</Text>
          <Text className="text-ink-muted text-sm mb-5 leading-5">
            Choose a day, then pick a time window. You can add details and the address in the next steps.
          </Text>

          <Text className="text-sm font-bold text-ink mb-2">Day</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          >
            {dayOptions.map((d) => {
              const active = d.getTime() === selectedDay.getTime();
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  onPress={() => setSelectedDay(d)}
                  activeOpacity={0.85}
                  className={`px-4 py-3 rounded-2xl border ${
                    active ? "bg-primary-600 border-primary-600" : "bg-canvas-raised border-ink-faint"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${active ? "text-white" : "text-ink"}`}
                  >
                    {formatDayChip(d)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text className="text-sm font-bold text-ink mb-2">Time</Text>
          <View className="flex-row flex-wrap gap-2 mb-8">
            {SLOT_LABELS.map((slot) => {
              const active = selectedHour === slot.hour;
              return (
                <TouchableOpacity
                  key={slot.label}
                  onPress={() => setSelectedHour(slot.hour)}
                  activeOpacity={0.85}
                  className={`px-4 py-2.5 rounded-xl border ${
                    active ? "bg-ink border-ink" : "bg-canvas-raised border-ink-faint"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${active ? "text-white" : "text-ink-soft"}`}
                  >
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            className="bg-primary-600 rounded-2xl py-4 items-center active:opacity-90"
            onPress={() => setStep(2)}
            activeOpacity={0.9}
          >
            <Text className="text-white font-bold text-base">Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text className="text-lg font-bold text-ink mb-1">Describe the booking</Text>
          <Text className="text-ink-muted text-sm mb-5 leading-5">
            Optional: access instructions, vehicle details, or anything the provider should know before they arrive.
          </Text>

          <Text className="text-sm font-bold text-ink mb-2">Notes (optional)</Text>
          <TextInput
            className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 text-ink text-base mb-8 min-h-[120px]"
            placeholder="e.g. Ring doorbell twice, car in driveway…"
            placeholderTextColor={PLACEHOLDER_MUTED}
            style={[textInputBaselineStyle, { textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-ink-faint rounded-2xl py-4 items-center bg-canvas-raised"
              onPress={() => setStep(1)}
              activeOpacity={0.85}
            >
              <Text className="text-ink font-semibold">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary-600 rounded-2xl py-4 items-center active:opacity-90"
              onPress={() => setStep(3)}
              activeOpacity={0.9}
            >
              <Text className="text-white font-bold text-base">Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Text className="text-lg font-bold text-ink mb-1">Where should we meet you?</Text>
          <Text className="text-ink-muted text-sm mb-4 leading-5">
            Enter the full service address. You can fill coordinates using your location for more accurate routing.
          </Text>

          <View className="bg-primary-50 border border-primary-200 rounded-2xl p-4 mb-5">
            <Text className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-1">Scheduled</Text>
            <Text className="text-ink font-semibold">{formatSlotSummary(selectedDay, selectedHour)}</Text>
            {notes.trim() ? (
              <Text className="text-ink-soft text-sm mt-2" numberOfLines={3}>
                Note: {notes.trim()}
              </Text>
            ) : null}
          </View>

          <Text className="text-sm font-bold text-ink mb-2">Service address</Text>
          <TextInput
            className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 text-ink text-base mb-3 min-h-[88px]"
            placeholder="Street, apartment, city, ZIP"
            placeholderTextColor={PLACEHOLDER_MUTED}
            style={[textInputBaselineStyle, { textAlignVertical: "top" }]}
            value={address}
            onChangeText={setAddress}
            multiline
          />

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-primary-200 bg-primary-50 mb-2"
            onPress={useMyLocation}
            disabled={locating}
            activeOpacity={0.85}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#E8521A" />
            ) : (
              <Ionicons name="navigate-outline" size={20} color="#E8521A" />
            )}
            <Text className="text-primary-700 font-semibold text-sm">Use my location for map pin</Text>
          </TouchableOpacity>

          {formError ? (
            <Text className="text-red-600 text-sm mb-4">{formError}</Text>
          ) : (
            <View className="mb-4" />
          )}

          <View className="flex-row gap-3 mb-2">
            <TouchableOpacity
              className="flex-1 border border-ink-faint rounded-2xl py-4 items-center bg-canvas-raised"
              onPress={() => setStep(2)}
              activeOpacity={0.85}
            >
              <Text className="text-ink font-semibold">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary-600 rounded-2xl py-4 items-center active:opacity-90"
              onPress={() => void submit()}
              disabled={createBooking.isPending || !address.trim()}
              activeOpacity={0.9}
            >
              {createBooking.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Confirm booking</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
