import { useCallback, useEffect, useMemo, useState } from "react";

import { Pressable, RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useMe, useUpdateProviderAvailability, useUpdateProviderPresence } from "@repo/api-client";
import {
  civilDateKeyFromLocal,
  lockedAvailabilityDates,
  mergeRollingAvailability,
  parseCivilDateKey,
  type ProviderAvailabilityDay,
} from "@repo/schemas";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { AvailabilityMonthGrid } from "../../../components/AvailabilityMonthGrid";
import { appColors } from "../../../styles/colors";

function formatHour(hour: number): string {
  const safeHour = ((hour % 24) + 24) % 24;
  if (safeHour === 0) return "12:00 AM";
  if (safeHour < 12) return `${safeHour}:00 AM`;
  if (safeHour === 12) return "12:00 PM";
  return `${safeHour - 12}:00 PM`;
}

function formatRangeLabel(days: ProviderAvailabilityDay[]): string {
  if (days.length === 0) return "Next 30 days";
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "Next 30 days";
  const fmt = (dateKey: string) => {
    const { year, month, day } = parseCivilDateKey(dateKey);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };
  return `${fmt(first.date)} – ${fmt(last.date)}`;
}

function weekdayFromKey(dateKey: string): number {
  const { year, month, day } = parseCivilDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { data: me, refetch: refetchMe, isRefetching } = useMe({ enabled: true });
  const updateProviderPresence = useUpdateProviderPresence();
  const updateProviderAvailability = useUpdateProviderAvailability();
  const [isOnline, setIsOnline] = useState(false);
  const [days, setDays] = useState<ProviderAvailabilityDay[]>(() =>
    mergeRollingAvailability(civilDateKeyFromLocal(new Date()), undefined)
  );
  const [selectedDate, setSelectedDate] = useState(days[0]?.date);

  useEffect(() => {
    setIsOnline(me?.providerMetrics?.isOnline ?? false);
  }, [me?.providerMetrics?.isOnline]);

  useEffect(() => {
    const next = mergeRollingAvailability(
      civilDateKeyFromLocal(new Date()),
      me?.providerMetrics?.availabilityDays
    );
    setDays(next);
    setSelectedDate((current) =>
      next.some((day) => day.date === current) ? current : next[0]?.date
    );
  }, [me?.providerMetrics?.availabilityDays]);

  const lockedDates = useMemo(
    () => lockedAvailabilityDates(me?.providerMetrics?.availabilityDays),
    [me?.providerMetrics?.availabilityDays]
  );
  const lockedDateList = useMemo(() => [...lockedDates], [lockedDates]);

  const hourSource = useMemo(() => {
    const selected = days.find((day) => day.date === selectedDate);
    if (selected && lockedDates.has(selected.date)) return selected;
    return days.find((day) => day.enabled && !lockedDates.has(day.date)) ?? days.find((day) => day.enabled);
  }, [days, selectedDate, lockedDates]);
  const startHour = hourSource?.startHour ?? 9;
  const endHour = hourSource?.endHour ?? 18;
  const pendingCount = days.filter((day) => day.enabled && !lockedDates.has(day.date)).length;
  const selectedIsLocked = Boolean(selectedDate && lockedDates.has(selectedDate));

  const refetchMeSafely = useCallback(async () => {
    try {
      const result = await refetchMe();
      if (result.isError) {
        const err = result.error ?? new Error("Failed to refresh schedule");
        reportError(err, { screen: "ProviderSchedule", action: "refetchMe" });
        showToast("error", "Could not refresh schedule right now.");
      }
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderSchedule", action: "refetchMe" });
      showToast("error", "Could not refresh schedule right now.");
    }
  }, [refetchMe]);

  useFocusEffect(
    useCallback(() => {
      void refetchMeSafely();
    }, [refetchMeSafely])
  );

  async function handlePresenceToggle(nextValue: boolean) {
    if (nextValue && me?.providerMetrics?.verificationStatus !== "APPROVED") {
      showToast(
        "error",
        "Not approved yet",
        "An admin must approve your account before you can go online."
      );
      return;
    }
    setIsOnline(nextValue);
    try {
      await updateProviderPresence.mutateAsync(nextValue);
      showToast("success", nextValue ? "You are now online." : "You are now offline.");
    } catch (error: unknown) {
      setIsOnline(!nextValue);
      reportError(error, { screen: "ProviderSchedule", action: "handlePresenceToggle" });
      showToast("error", error instanceof Error ? error.message : "Failed to update availability");
    }
  }

  function applyHoursToEnabled(nextStart: number, nextEnd: number) {
    if (selectedIsLocked) return;
    const start = Math.min(22, Math.max(0, nextStart));
    const end = Math.min(23, Math.max(start, nextEnd));
    setDays((prev) =>
      prev.map((day) =>
        day.enabled && !lockedDates.has(day.date) ? { ...day, startHour: start, endHour: end } : day
      )
    );
  }

  function toggleDay(dateKey: string) {
    setSelectedDate(dateKey);
    if (lockedDates.has(dateKey)) return;
    setDays((prev) =>
      prev.map((day) => {
        if (day.date !== dateKey) return day;
        const enabled = !day.enabled;
        return {
          ...day,
          enabled,
          startHour: enabled ? startHour : day.startHour,
          endHour: enabled ? endHour : day.endHour,
        };
      })
    );
  }

  function enableWeekdays() {
    setDays((prev) =>
      prev.map((day) => {
        if (lockedDates.has(day.date)) return day;
        const enabled = weekdayFromKey(day.date) !== 0;
        return {
          ...day,
          enabled,
          startHour: enabled ? startHour : day.startHour,
          endHour: enabled ? endHour : day.endHour,
        };
      })
    );
  }

  async function handleSaveMonth() {
    try {
      await updateProviderAvailability.mutateAsync(days);
      showToast("success", `Saved ${pendingCount} new scheduled day${pendingCount === 1 ? "" : "s"}.`);
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderSchedule", action: "handleSaveMonth" });
      showToast("error", error instanceof Error ? error.message : "Could not save calendar.");
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas px-5"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: Math.max(insets.bottom + 20, 32),
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetchMeSafely()}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-3xl font-bold text-ink mb-2" style={{ letterSpacing: -0.5 }}>Schedule</Text>
      <Text className="text-ink-muted text-sm mb-6">
        Set days from today through the next 30 days. Scheduled days stay locked.
      </Text>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-ink font-semibold text-base">Availability</Text>
            <Text className="text-ink-muted text-sm mt-0.5">
              Customers see this as your online/offline status.
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={(value) => void handlePresenceToggle(value)}
          />
        </View>
        <View className="mt-3 rounded-xl bg-canvas px-3 py-2.5 border border-ink-faint flex-row items-center gap-2">
          <Ionicons
            name={isOnline ? "radio-button-on-outline" : "radio-button-off-outline"}
            size={16}
            color={isOnline ? appColors.semantic.success : appColors.ink.subtle}
          />
          <Text className={`text-sm font-medium flex-1 ${isOnline ? "text-primary-700" : "text-ink-muted"}`}>
            {me?.providerMetrics?.verificationStatus &&
            me.providerMetrics.verificationStatus !== "APPROVED"
              ? "Admin approval required before you can go online."
              : isOnline
                ? "You are currently online and visible to customers."
                : "You are offline for new requests."}
          </Text>
        </View>
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-ink font-semibold text-base">Next 30 days</Text>
          <Text className="text-ink-muted text-xs">{formatRangeLabel(days)}</Text>
        </View>
        <Text className="text-ink-muted text-sm mb-3">
          Tap an unscheduled day to open it. Green days are already saved and cannot be changed.
        </Text>

        <AvailabilityMonthGrid
          days={days}
          selectedDate={selectedDate}
          onPressDay={toggleDay}
          allowDisabledPress
          lockedDates={lockedDateList}
        />

        <TouchableOpacity
          className="mt-3 py-2.5 rounded-xl border border-ink-faint items-center bg-canvas"
          onPress={enableWeekdays}
          accessibilityRole="button"
          accessibilityLabel="Enable unscheduled weekdays"
        >
          <Text className="text-ink font-medium">Schedule remaining weekdays</Text>
        </TouchableOpacity>

        <View className="mt-4" style={{ opacity: selectedIsLocked ? 0.45 : 1 }}>
          <Text className="text-ink font-medium mb-2">Working hours</Text>
          <Text className="text-ink-muted text-xs mb-2">
            {selectedIsLocked
              ? "Hours on scheduled days are locked."
              : "These hours apply to newly opened days."}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable
                className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                onPress={() => applyHoursToEnabled(startHour - 1, endHour)}
                disabled={selectedIsLocked}
                accessibilityRole="button"
                accessibilityLabel="Decrease start time"
              >
                <Ionicons name="remove" size={16} color={appColors.ink.soft} />
              </Pressable>
              <Text className="text-ink text-sm font-medium min-w-[86px]">{formatHour(startHour)}</Text>
              <Pressable
                className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                onPress={() => applyHoursToEnabled(startHour + 1, endHour)}
                disabled={selectedIsLocked}
                accessibilityRole="button"
                accessibilityLabel="Increase start time"
              >
                <Ionicons name="add" size={16} color={appColors.ink.soft} />
              </Pressable>
            </View>
            <Text className="text-ink-muted text-xs">to</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                onPress={() => applyHoursToEnabled(startHour, endHour - 1)}
                disabled={selectedIsLocked}
                accessibilityRole="button"
                accessibilityLabel="Decrease end time"
              >
                <Ionicons name="remove" size={16} color={appColors.ink.soft} />
              </Pressable>
              <Text className="text-ink text-sm font-medium min-w-[86px]">{formatHour(endHour)}</Text>
              <Pressable
                className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                onPress={() => applyHoursToEnabled(startHour, endHour + 1)}
                disabled={selectedIsLocked}
                accessibilityRole="button"
                accessibilityLabel="Increase end time"
              >
                <Ionicons name="add" size={16} color={appColors.ink.soft} />
              </Pressable>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="mt-4 bg-primary-600 rounded-2xl py-3 items-center"
          disabled={updateProviderAvailability.isPending || pendingCount === 0}
          style={{ opacity: updateProviderAvailability.isPending || pendingCount === 0 ? 0.65 : 1 }}
          onPress={() => void handleSaveMonth()}
          accessibilityRole="button"
          accessibilityLabel="Save new scheduled days"
        >
          <Text className="text-white font-semibold">
            {updateProviderAvailability.isPending
              ? "Saving…"
              : pendingCount === 0
                ? lockedDates.size > 0
                  ? "Month already scheduled"
                  : "Pick days to schedule"
                : `Save ${pendingCount} new day${pendingCount === 1 ? "" : "s"}`}
          </Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}
