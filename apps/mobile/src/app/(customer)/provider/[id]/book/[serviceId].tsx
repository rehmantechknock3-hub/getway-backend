import { useCallback, useMemo, useState } from "react";

import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
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
  useCreateBooking,
  useProvider,
  useProviderServices,
} from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { appColors } from "../../../../../styles/colors";
import { textInputBaselineStyle } from "../../../../../styles/text-input";

const DAY_OFFSETS = [1, 2, 3, 5, 7] as const;
const SLOT_LABELS = [
  { label: "Morning", hour: 9 },
  { label: "Midday", hour: 12 },
  { label: "Afternoon", hour: 15 },
  { label: "Evening", hour: 18 },
] as const;

const PLACEHOLDER_MUTED = appColors.ink.subtle;

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

function formatMoney(n: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

type Step = 1 | 2 | 3;

export default function BookServiceScreen() {
  const { id, serviceId } = useLocalSearchParams<{ id: string; serviceId: string }>();
  const providerId = typeof id === "string" ? id : id?.[0] ?? "";
  const svcId = typeof serviceId === "string" ? serviceId : serviceId?.[0] ?? "";
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

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

  const servicesQuery = useProviderServices(providerId, {
    enabled: isLoaded && isSignedIn && !!providerId,
  });
  const providerQuery = useProvider(providerId);
  const createBooking = useCreateBooking();

  const service = useMemo(
    () => servicesQuery.data?.find((s) => s.id === svcId),
    [servicesQuery.data, svcId]
  );

  const scheduledAt = useMemo(
    () => combineDateAndHour(selectedDay, selectedHour),
    [selectedDay, selectedHour]
  );

  const providerName = useMemo(() => {
    const p = providerQuery.data;
    if (!p) return "Provider";
    return `${p.firstName} ${p.lastName}`.trim();
  }, [providerQuery.data]);

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
    } catch (error: unknown) {
      reportError(error, { action: "book_use_my_location" });
      setFormError("Could not read your location. Try again or enter an address.");
    } finally {
      setLocating(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!svcId || !address.trim()) return;
    if (providerQuery.data && !providerQuery.data.isOnline) {
      setFormError("Provider is offline right now. Booking is unavailable.");
      return;
    }
    const lat = coords?.latitude ?? 0;
    const lon = coords?.longitude ?? 0;
    setFormError(null);
    try {
      const booking = await createBooking.mutateAsync({
        serviceId: svcId,
        scheduledAt,
        address: address.trim(),
        latitude: lat,
        longitude: lon,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      await queryClient.refetchQueries({ queryKey: bookingKeys.all() });
      setCreatedBookingId(booking.id);
    } catch (error: unknown) {
      reportError(error, { action: "create_booking", extra: { serviceId: svcId } });
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("offline")) {
        setFormError("Provider is offline right now. Booking is unavailable.");
        return;
      }
      setFormError("Booking failed. Check your connection and try again.");
      showToast("error", "Booking failed", "Please try again.");
    }
  }, [svcId, address, providerQuery.data, coords, scheduledAt, notes, createBooking, queryClient]);

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
        <ActivityIndicator color={appColors.primary[600]} />
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

  if (providerQuery.isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <ActivityIndicator color={appColors.primary[600]} />
        <Text className="text-ink-muted text-sm mt-4 text-center">Loading provider…</Text>
      </View>
    );
  }

  if (providerQuery.isError || !providerQuery.data) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink text-center font-medium mb-2">Could not load provider</Text>
        <Text className="text-ink-muted text-sm text-center mb-6">
          We need to confirm the provider is online before booking.
        </Text>
        <TouchableOpacity
          className="bg-primary-600 rounded-2xl px-6 py-3 mb-3"
          onPress={() => void providerQuery.refetch()}
          activeOpacity={0.9}
        >
          <Text className="text-white font-bold">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
          <Text className="text-primary-600 font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!providerQuery.data.isOnline && !createdBookingId) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Ionicons name="moon-outline" size={40} color={appColors.ink.subtle} />
        <Text className="text-ink text-center font-semibold text-lg mt-4 mb-2">
          Can&apos;t book — provider is offline
        </Text>
        <Text className="text-ink-muted text-sm text-center leading-5 mb-6">
          Their status is Offline, so new bookings are blocked until they go online. Check back later.
        </Text>
        <TouchableOpacity
          className="bg-primary-600 rounded-2xl px-6 py-3"
          onPress={() => router.back()}
          activeOpacity={0.9}
        >
          <Text className="text-white font-bold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* Dark success state — same route, template screen 8 */
  if (createdBookingId) {
    return (
      <View
        className="flex-1 bg-surface-night"
        style={{ paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom + 24, 32) }}
      >
        <StatusBar barStyle="light-content" />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, flexGrow: 1, justifyContent: "center" }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-surface-elevated items-center justify-center mb-5 border border-surface-border">
              <Ionicons name="checkmark-circle" size={52} color={appColors.semantic.success} />
            </View>
            <Text className="text-white text-2xl font-bold text-center mb-2">
              Booking confirmed
            </Text>
            <Text className="text-surface-muted text-sm text-center leading-5 px-4">
              Your request was sent. You can track it anytime under Bookings.
            </Text>
          </View>

          <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-5">
            <Text className="text-surface-muted text-xs font-semibold mb-3 uppercase tracking-wide">
              Summary
            </Text>
            <Text className="text-white font-semibold text-base mb-1">{service.title}</Text>
            <Text className="text-surface-soft text-sm mb-3">{providerName}</Text>
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="calendar-outline" size={16} color={appColors.glow.blue} />
              <Text className="text-surface-soft text-sm">
                {formatSlotSummary(selectedDay, selectedHour)}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="location-outline" size={16} color={appColors.glow.blue} />
              <Text className="text-surface-soft text-sm flex-1" numberOfLines={2}>
                {address.trim()}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="cash-outline" size={16} color={appColors.glow.blue} />
              <Text className="text-white font-semibold">
                {formatMoney(service.price, service.priceCurrency)}
              </Text>
            </View>
          </View>

          <View className="bg-surface-elevated border border-surface-border rounded-2xl p-4 mb-8">
            <Text className="text-white font-semibold mb-3">What happens next?</Text>
            {[
              "The provider will review and accept your request",
              "You’ll get updates as the booking status changes",
              "Track progress and message them from the appointment",
            ].map((line) => (
              <View key={line} className="flex-row items-start gap-2.5 mb-2.5">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={appColors.semantic.success}
                />
                <Text className="text-surface-soft text-sm flex-1 leading-5">{line}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            className="bg-glow-blue rounded-2xl py-4 items-center mb-3"
            activeOpacity={0.9}
            onPress={() =>
              router.replace(`/(customer)/booking/${createdBookingId}` as const)
            }
          >
            <Text className="text-white font-bold text-base">View appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="border border-surface-border rounded-2xl py-4 items-center"
            activeOpacity={0.85}
            onPress={() => router.replace("/(customer)/(tabs)/bookings")}
          >
            <Text className="text-surface-soft font-semibold">Go to bookings</Text>
          </TouchableOpacity>
        </ScrollView>
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
      <StatusBar barStyle="dark-content" />

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-5 mb-5">
        <Text className="text-xs font-semibold text-primary-600 mb-1">You&apos;re booking</Text>
        <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.3 }}>
          {service.title}
        </Text>
        <Text className="text-ink-muted text-sm mt-1">{service.categoryName}</Text>
        <Text className="text-primary-600 font-bold mt-2">
          {formatMoney(service.price, service.priceCurrency)}
        </Text>
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
          <Text className="text-lg font-bold text-ink mb-1">Pick a date & time</Text>
          <Text className="text-ink-muted text-sm mb-5 leading-5">
            Choose a day, then select a time window.
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
                    active
                      ? "bg-primary-50 border-primary-600"
                      : "bg-canvas-raised border-ink-faint"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${active ? "text-primary-600" : "text-ink"}`}
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
                  className={`px-4 py-2.5 rounded-2xl border min-w-[44%] ${
                    active
                      ? "bg-primary-50 border-primary-600"
                      : "bg-canvas-raised border-ink-faint"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold text-center ${
                      active ? "text-primary-600" : "text-ink-soft"
                    }`}
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
          <Text className="text-lg font-bold text-ink mb-1">Add notes</Text>
          <Text className="text-ink-muted text-sm mb-5 leading-5">
            Optional: access instructions, vehicle details, or anything the provider should know.
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
          <Text className="text-lg font-bold text-ink mb-1">Review & confirm</Text>
          <Text className="text-ink-muted text-sm mb-4 leading-5">
            Check the details, then confirm your booking.
          </Text>

          <View className="gap-3 mb-5">
            <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4">
              <Text className="text-ink-muted text-xs font-semibold mb-1">Provider</Text>
              <Text className="text-ink font-semibold">{providerName}</Text>
            </View>
            <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4">
              <Text className="text-ink-muted text-xs font-semibold mb-1">Service</Text>
              <Text className="text-ink font-semibold">{service.title}</Text>
              <Text className="text-primary-600 font-bold mt-1">
                {formatMoney(service.price, service.priceCurrency)}
              </Text>
            </View>
            <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4">
              <Text className="text-ink-muted text-xs font-semibold mb-1">Date & time</Text>
              <Text className="text-ink font-semibold">
                {formatSlotSummary(selectedDay, selectedHour)}
              </Text>
              {notes.trim() ? (
                <Text className="text-ink-soft text-sm mt-2" numberOfLines={3}>
                  Note: {notes.trim()}
                </Text>
              ) : null}
            </View>
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
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-primary-100 bg-primary-50 mb-2"
            onPress={useMyLocation}
            disabled={locating}
            activeOpacity={0.85}
          >
            {locating ? (
              <ActivityIndicator size="small" color={appColors.primary[600]} />
            ) : (
              <Ionicons name="navigate-outline" size={20} color={appColors.primary[600]} />
            )}
            <Text className="text-primary-600 font-semibold text-sm">Use my location for map pin</Text>
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
                <ActivityIndicator color={appColors.onPrimary} />
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
