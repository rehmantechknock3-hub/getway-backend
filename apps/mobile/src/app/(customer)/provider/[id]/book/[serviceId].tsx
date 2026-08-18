import { useCallback, useEffect, useMemo, useState } from "react";

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
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import {
  bookingKeys,
  fetchReverseGeocode,
  useCreateBooking,
  useProvider,
  useProviderServices,
} from "@repo/api-client";
import {
  civilDateKeyFromLocal,
  hourOverlapsBookedSlot,
  mergeRollingAvailability,
  parseCivilDateKey,
  type ProviderAvailabilityDay,
  type ProviderBookedSlot,
} from "@repo/schemas";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { AvailabilityMonthGrid } from "../../../../../components/AvailabilityMonthGrid";
import { LocationPreviewMap } from "../../../../../components/LocationPreviewMap";
import { appColors } from "../../../../../styles/colors";
import { textInputBaselineStyle } from "../../../../../styles/text-input";
import { requestDeviceLocation } from "../../../../../utils/device-location";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateFromKey(dateKey: string): Date {
  const { year, month, day } = parseCivilDateKey(dateKey);
  return startOfDay(new Date(year, month - 1, day));
}

function combineDateAndHour(day: Date, hour: number): Date {
  const x = new Date(day);
  x.setHours(hour, 0, 0, 0);
  return x;
}

function formatHour(hour: number): string {
  const safeHour = ((hour % 24) + 24) % 24;
  if (safeHour === 0) return "12:00 AM";
  if (safeHour < 12) return `${safeHour}:00 AM`;
  if (safeHour === 12) return "12:00 PM";
  return `${safeHour - 12}:00 PM`;
}

function formatDayChip(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatSlotSummary(dateKey: string, hour: number): string {
  return `${formatDayChip(dateFromKey(dateKey))} · ${formatHour(hour)}`;
}

function hourIsBooked(
  day: ProviderAvailabilityDay,
  hour: number,
  bookedSlots: ProviderBookedSlot[],
  durationMinutes: number
): boolean {
  return bookedSlots.some((slot) => hourOverlapsBookedSlot(day.date, hour, slot, durationMinutes));
}

function bookableHours(
  day: ProviderAvailabilityDay,
  now: Date,
  bookedSlots: ProviderBookedSlot[] = [],
  durationMinutes = 60
): number[] {
  const hours: number[] = [];
  for (let hour = day.startHour; hour <= day.endHour; hour++) {
    const at = combineDateAndHour(dateFromKey(day.date), hour);
    if (at.getTime() <= now.getTime() + 5 * 60 * 1000) continue;
    if (hourIsBooked(day, hour, bookedSlots, durationMinutes)) continue;
    hours.push(hour);
  }
  return hours;
}

function listedHours(day: ProviderAvailabilityDay, now: Date): number[] {
  const hours: number[] = [];
  for (let hour = day.startHour; hour <= day.endHour; hour++) {
    const at = combineDateAndHour(dateFromKey(day.date), hour);
    if (at.getTime() > now.getTime() + 5 * 60 * 1000) hours.push(hour);
  }
  return hours;
}

const PLACEHOLDER_MUTED = appColors.ink.subtle;

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
  const now = useMemo(() => new Date(), []);

  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [didAutoLocate, setDidAutoLocate] = useState(false);

  const servicesQuery = useProviderServices(providerId, {
    enabled: isLoaded && isSignedIn && !!providerId,
  });
  const providerQuery = useProvider(providerId);
  const createBooking = useCreateBooking();

  const monthDays = useMemo(
    () =>
      mergeRollingAvailability(
        civilDateKeyFromLocal(now),
        providerQuery.data?.availabilityDays
      ),
    [now, providerQuery.data?.availabilityDays]
  );
  const bookedSlots = providerQuery.data?.bookedSlots ?? [];
  const service = useMemo(
    () => servicesQuery.data?.find((s) => s.id === svcId),
    [servicesQuery.data, svcId]
  );
  const durationMinutes = service?.duration ?? 60;
  const bookableDays = useMemo(
    () =>
      monthDays.filter(
        (day) => day.enabled && bookableHours(day, now, bookedSlots, durationMinutes).length > 0
      ),
    [monthDays, now, bookedSlots, durationMinutes]
  );
  const bookedDates = useMemo(
    () =>
      monthDays
        .filter((day) => {
          if (!day.enabled) return false;
          const listed = listedHours(day, now);
          if (listed.length === 0) return false;
          return listed.every((hour) => hourIsBooked(day, hour, bookedSlots, durationMinutes));
        })
        .map((day) => day.date),
    [monthDays, now, bookedSlots, durationMinutes]
  );
  const selectedDay = useMemo(
    () => monthDays.find((day) => day.date === selectedDate) ?? bookableDays[0],
    [monthDays, selectedDate, bookableDays]
  );
  const listedHourOptions = useMemo(
    () => (selectedDay ? listedHours(selectedDay, now) : []),
    [selectedDay, now]
  );
  const hourOptions = useMemo(
    () => (selectedDay ? bookableHours(selectedDay, now, bookedSlots, durationMinutes) : []),
    [selectedDay, now, bookedSlots, durationMinutes]
  );

  useEffect(() => {
    if (!selectedDay && bookableDays[0]) {
      setSelectedDate(bookableDays[0].date);
      const hours = bookableHours(bookableDays[0], now, bookedSlots, durationMinutes);
      if (hours[0] != null) setSelectedHour(hours[0]);
      return;
    }
    if (selectedDay && !bookableDays.some((day) => day.date === selectedDay.date)) {
      const next = bookableDays[0];
      setSelectedDate(next?.date);
      const hours = next ? bookableHours(next, now, bookedSlots, durationMinutes) : [];
      if (hours[0] != null) setSelectedHour(hours[0]);
      return;
    }
    if (hourOptions.length > 0 && !hourOptions.includes(selectedHour)) {
      setSelectedHour(hourOptions[0] ?? 9);
    }
  }, [bookableDays, bookedSlots, durationMinutes, hourOptions, now, selectedDay, selectedHour]);

  const scheduledAt = useMemo(
    () => combineDateAndHour(dateFromKey(selectedDay?.date ?? civilDateKeyFromLocal(now)), selectedHour),
    [selectedDay?.date, selectedHour, now]
  );

  const providerName = useMemo(() => {
    const p = providerQuery.data;
    if (!p) return "Provider";
    return `${p.firstName} ${p.lastName}`.trim();
  }, [providerQuery.data]);

  const useMyLocation = useCallback(async (opts?: { silent?: boolean }) => {
    setFormError(null);
    setLocating(true);
    try {
      const result = await requestDeviceLocation({
        context: { screen: "BookService", action: "useMyLocation" },
      });
      if (!result.ok) {
        setLocationPermissionDenied(result.reason === "denied");
        if (!opts?.silent) {
          setFormError(
            result.reason === "denied"
              ? "Location permission denied. Enter your service address manually."
              : "Could not read your location. Enter an address manually."
          );
        }
        return;
      }
      setLocationPermissionDenied(false);
      setCoords({
        latitude: result.data.coords.latitude,
        longitude: result.data.coords.longitude,
      });
      setAddress(result.data.addressLabel);
      setMapEpoch((n) => n + 1);
    } catch (error: unknown) {
      reportError(error, { action: "book_use_my_location" });
      if (!opts?.silent) {
        setFormError("Could not read your location. Try again or enter an address.");
      }
    } finally {
      setLocating(false);
    }
  }, []);

  const applyMapTap = useCallback(async (next: { latitude: number; longitude: number }) => {
    setFormError(null);
    setCoords(next);
    setLocating(true);
    try {
      const result = await fetchReverseGeocode(next.latitude, next.longitude);
      setAddress(result.address);
    } catch (error: unknown) {
      reportError(error, { action: "book_map_tap" });
      setAddress(`${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}`);
      showToast("info", "Pinned the map. Address lookup failed — you can still edit it.");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 3 || didAutoLocate) return;
    setDidAutoLocate(true);
    void useMyLocation({ silent: true });
  }, [step, didAutoLocate, useMyLocation]);

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
                {formatSlotSummary(selectedDay?.date ?? "", selectedHour)}
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
              router.replace({
                pathname: "/(customer)/booking/[bookingId]",
                params: { bookingId: createdBookingId },
              })
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
            Book any open day in the next month. Booked times are marked and cannot be chosen.
          </Text>

          <Text className="text-sm font-bold text-ink mb-2">Day</Text>
          <View className="mb-5">
            <AvailabilityMonthGrid
              days={monthDays}
              selectedDate={selectedDay?.date}
              lockedDates={monthDays.filter((day) => day.enabled).map((day) => day.date)}
              bookedDates={bookedDates}
              onPressDay={(dateKey) => {
                const next = monthDays.find((day) => day.date === dateKey);
                if (!next?.enabled) return;
                if (bookedDates.includes(dateKey)) return;
                setSelectedDate(dateKey);
                const hours = bookableHours(next, now, bookedSlots, durationMinutes);
                if (hours[0] != null) setSelectedHour(hours[0]);
              }}
            />
          </View>

          {bookableDays.length === 0 ? (
            <Text className="text-ink-muted text-sm mb-8">
              This provider has no open times in the next month.
            </Text>
          ) : (
            <>
              <Text className="text-sm font-bold text-ink mb-2">Time</Text>
              <View className="flex-row flex-wrap gap-2 mb-8">
                {listedHourOptions.map((hour) => {
                  const booked = selectedDay
                    ? hourIsBooked(selectedDay, hour, bookedSlots, durationMinutes)
                    : false;
                  const active = !booked && selectedHour === hour;
                  return (
                    <TouchableOpacity
                      key={hour}
                      onPress={() => {
                        if (booked) return;
                        setSelectedHour(hour);
                      }}
                      disabled={booked}
                      activeOpacity={0.85}
                      className={`px-4 py-2.5 rounded-2xl border min-w-[44%] ${
                        booked
                          ? "bg-amber-50 border-amber-400"
                          : active
                            ? "bg-primary-50 border-primary-600"
                            : "bg-canvas-raised border-ink-faint"
                      }`}
                      style={{ opacity: booked ? 0.85 : 1 }}
                    >
                      <Text
                        className={`text-sm font-semibold text-center ${
                          booked ? "text-amber-800" : active ? "text-primary-600" : "text-ink-soft"
                        }`}
                      >
                        {booked ? `${formatHour(hour)} · Booked` : formatHour(hour)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            className="bg-primary-600 rounded-2xl py-4 items-center active:opacity-90"
            onPress={() => setStep(2)}
            disabled={!selectedDay || hourOptions.length === 0}
            style={{ opacity: !selectedDay || hourOptions.length === 0 ? 0.65 : 1 }}
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
                {formatSlotSummary(selectedDay?.date ?? "", selectedHour)}
              </Text>
              {notes.trim() ? (
                <Text className="text-ink-soft text-sm mt-2" numberOfLines={3}>
                  Note: {notes.trim()}
                </Text>
              ) : null}
            </View>
          </View>

          <Text className="text-sm font-bold text-ink mb-2">Service address</Text>
          <Text className="text-ink-muted text-xs mb-2 leading-4">
            {locating
              ? "Updating the pin…"
              : locationPermissionDenied
                ? "Location access was denied. Tap the map or type the address."
                : coords
                  ? "Check the pin. Tap the map to move it, or use GPS again."
                  : "Use GPS or tap the map so the provider gets the right spot."}
          </Text>
          <LocationPreviewMap
            title="Service location"
            description="Auto-detect, or tap the map to drop a pin."
            latitude={coords?.latitude}
            longitude={coords?.longitude}
            markers={coords ? [{ ...coords, id: "booking" }] : undefined}
            isLoading={locating}
            emptyMessage="Use GPS or tap the map to choose where the service should happen."
            onSelectCoordinate={(next) => void applyMapTap(next)}
            recenterKey={mapEpoch}
          />
          <TextInput
            className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 text-ink text-base mb-3 min-h-[88px]"
            placeholder="Street, apartment, city, ZIP"
            placeholderTextColor={PLACEHOLDER_MUTED}
            style={[textInputBaselineStyle, { textAlignVertical: "top" }]}
            value={address}
            onChangeText={setAddress}
            multiline
            editable={!locating}
          />

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-primary-100 bg-primary-50 mb-2"
            onPress={() => void useMyLocation()}
            disabled={locating}
            activeOpacity={0.85}
          >
            {locating ? (
              <ActivityIndicator size="small" color={appColors.primary[600]} />
            ) : (
              <Ionicons name="navigate-outline" size={20} color={appColors.primary[600]} />
            )}
            <Text className="text-primary-600 font-semibold text-sm">
              {locating ? "Detecting…" : "Use my current location"}
            </Text>
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
