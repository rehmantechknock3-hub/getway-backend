import { useCallback, useEffect, useState } from "react";

import { Pressable, RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useMe, useUpdateProviderPresence } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { appColors } from "../../../styles/colors";

type WeeklySlot = {
  day: string;
  enabled: boolean;
  startHour: number;
  endHour: number;
};

const INITIAL_WEEKLY_PLAN: WeeklySlot[] = [
  { day: "Mon", enabled: true, startHour: 9, endHour: 18 },
  { day: "Tue", enabled: true, startHour: 9, endHour: 18 },
  { day: "Wed", enabled: true, startHour: 9, endHour: 18 },
  { day: "Thu", enabled: true, startHour: 9, endHour: 18 },
  { day: "Fri", enabled: true, startHour: 9, endHour: 18 },
  { day: "Sat", enabled: true, startHour: 10, endHour: 16 },
  { day: "Sun", enabled: false, startHour: 10, endHour: 16 },
];

function formatHour(hour: number): string {
  const safeHour = ((hour % 24) + 24) % 24;
  if (safeHour === 0) return "12:00 AM";
  if (safeHour < 12) return `${safeHour}:00 AM`;
  if (safeHour === 12) return "12:00 PM";
  return `${safeHour - 12}:00 PM`;
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { data: me, refetch: refetchMe, isRefetching } = useMe({ enabled: true });
  const updateProviderPresence = useUpdateProviderPresence();
  const [isOnline, setIsOnline] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklySlot[]>(INITIAL_WEEKLY_PLAN);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  useEffect(() => {
    setIsOnline(me?.providerMetrics?.isOnline ?? false);
  }, [me?.providerMetrics?.isOnline]);

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

  function updateDayEnabled(index: number, enabled: boolean) {
    setWeeklyPlan((prev) =>
      prev.map((slot, slotIndex) => (slotIndex === index ? { ...slot, enabled } : slot))
    );
  }

  function shiftStartHour(index: number, direction: -1 | 1) {
    setWeeklyPlan((prev) =>
      prev.map((slot, slotIndex) => {
        if (slotIndex !== index) return slot;
        const nextStartHour = Math.min(22, Math.max(0, slot.startHour + direction));
        return {
          ...slot,
          startHour: nextStartHour,
          endHour: Math.max(nextStartHour + 1, slot.endHour),
        };
      })
    );
  }

  function shiftEndHour(index: number, direction: -1 | 1) {
    setWeeklyPlan((prev) =>
      prev.map((slot, slotIndex) => {
        if (slotIndex !== index) return slot;
        const nextEndHour = Math.min(23, Math.max(slot.startHour + 1, slot.endHour + direction));
        return {
          ...slot,
          endHour: nextEndHour,
        };
      })
    );
  }

  async function handleSaveWeeklyPlan() {
    setIsSavingPlan(true);
    try {
      const activeDays = weeklyPlan.filter((slot) => slot.enabled).length;
      showToast("success", `Weekly plan updated for ${activeDays} day${activeDays === 1 ? "" : "s"}.`);
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderSchedule", action: "handleSaveWeeklyPlan" });
      showToast("error", "Could not save weekly plan.");
    } finally {
      setIsSavingPlan(false);
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
        Control your availability and let customers know when you are ready.
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
          <Text className={`text-sm font-medium ${isOnline ? "text-primary-700" : "text-ink-muted"}`}>
            {isOnline ? "You are currently online and visible to customers." : "You are offline for new requests."}
          </Text>
        </View>
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-ink font-semibold text-base">Weekly plan</Text>
          <Text className="text-ink-muted text-xs">Tap +/- to adjust hours</Text>
        </View>
        <View className="gap-2.5">
          {weeklyPlan.map((slot, index) => (
            <View
              key={slot.day}
              className="bg-canvas border border-ink-faint rounded-2xl px-3 py-2.5"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-ink font-medium">{slot.day}</Text>
                <Switch
                  value={slot.enabled}
                  onValueChange={(value) => updateDayEnabled(index, value)}
                />
              </View>
              {slot.enabled ? (
                <View className="mt-2.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                      onPress={() => shiftStartHour(index, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease ${slot.day} start time`}
                    >
                      <Ionicons name="remove" size={16} color={appColors.ink.soft} />
                    </Pressable>
                    <Text className="text-ink text-sm font-medium min-w-[86px]">{formatHour(slot.startHour)}</Text>
                    <Pressable
                      className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                      onPress={() => shiftStartHour(index, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase ${slot.day} start time`}
                    >
                      <Ionicons name="add" size={16} color={appColors.ink.soft} />
                    </Pressable>
                  </View>
                  <Text className="text-ink-muted text-xs">to</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                      onPress={() => shiftEndHour(index, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease ${slot.day} end time`}
                    >
                      <Ionicons name="remove" size={16} color={appColors.ink.soft} />
                    </Pressable>
                    <Text className="text-ink text-sm font-medium min-w-[86px]">{formatHour(slot.endHour)}</Text>
                    <Pressable
                      className="w-8 h-8 rounded-lg border border-ink-faint items-center justify-center"
                      onPress={() => shiftEndHour(index, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase ${slot.day} end time`}
                    >
                      <Ionicons name="add" size={16} color={appColors.ink.soft} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text className="text-ink-muted text-sm mt-2.5">Off day</Text>
              )}
            </View>
          ))}
        </View>
        <TouchableOpacity
          className="mt-3 bg-primary-600 rounded-2xl py-3 items-center"
          disabled={isSavingPlan}
          style={{ opacity: isSavingPlan ? 0.65 : 1 }}
          onPress={() => void handleSaveWeeklyPlan()}
          accessibilityRole="button"
          accessibilityLabel="Save weekly schedule plan"
        >
          <Text className="text-white font-semibold">Save weekly plan</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}
