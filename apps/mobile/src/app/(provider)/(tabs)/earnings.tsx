import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import { setAuthToken, useProviderBookings, useProviderPayoutSummary } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { appColors } from "../../../styles/colors";

type DateRangeFilter = "week" | "month" | "all";

function formatMoney(value: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value instanceof Date ? value : new Date(value));
}

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [apiReady, setApiReady] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setApiReady(false);
      return;
    }
    let cancelled = false;
    void getToken()
      .then((token) => {
        if (cancelled) return;
        setAuthToken(token);
        setApiReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setApiReady(false);
        reportError(error, { screen: "ProviderEarnings", action: "resolveAuthToken" });
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const enabled = isLoaded && isSignedIn && apiReady;
  const historyQuery = useProviderBookings(1, { enabled, scope: "history" });
  const payoutSummaryQuery = useProviderPayoutSummary(dateRange, { enabled });
  const stats = historyQuery.data?.stats;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void Promise.all([historyQuery.refetch(), payoutSummaryQuery.refetch()]).catch((error: unknown) => {
        reportError(error, { screen: "ProviderEarnings", action: "refetchEarnings" });
        showToast("error", "Could not refresh earnings right now.");
      });
    }, [enabled, historyQuery.refetch, payoutSummaryQuery.refetch])
  );

  const payoutHistory = useMemo(
    () =>
      (historyQuery.data?.data ?? []).filter((booking) => booking.status === "COMPLETED"),
    [historyQuery.data?.data]
  );

  const filteredPayouts = useMemo(() => {
    if (dateRange === "all") return payoutHistory;
    const now = new Date();
    const start = new Date(now);
    if (dateRange === "week") {
      start.setDate(now.getDate() - 7);
    } else {
      start.setMonth(now.getMonth() - 1);
    }
    return payoutHistory.filter((row) => new Date(row.updatedAt).getTime() >= start.getTime());
  }, [dateRange, payoutHistory]);

  const completedCount = dateRange === "all" ? (stats?.completed ?? 0) : filteredPayouts.length;
  const totalEarnings = dateRange === "all"
    ? (stats?.totalEarnings ?? 0)
    : filteredPayouts.reduce((sum, row) => sum + row.totalAmount, 0);
  const averagePayout = completedCount > 0 ? totalEarnings / completedCount : 0;
  const pendingCount = payoutSummaryQuery.data?.pendingCount ?? 0;
  const pendingAmount = payoutSummaryQuery.data?.pendingAmount ?? 0;
  const payoutCurrency = payoutSummaryQuery.data?.currency ?? "USD";

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom + 32, 40),
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={enabled && (historyQuery.isRefetching || payoutSummaryQuery.isRefetching)}
          onRefresh={() =>
            void Promise.all([historyQuery.refetch(), payoutSummaryQuery.refetch()]).catch(
              (error: unknown) => {
                reportError(error, { screen: "ProviderEarnings", action: "pullToRefresh" });
                showToast("error", "Could not refresh earnings right now.");
              }
            )
          }
        />
      }
    >
      <Text className="text-3xl font-bold text-ink mb-6">Earnings</Text>

      {!enabled || historyQuery.isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : historyQuery.isError ? (
        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-6">
          <Text className="text-ink font-semibold text-base text-center mb-2">
            Could not load earnings
          </Text>
          <Text className="text-ink-muted text-sm text-center">
            Pull to refresh or confirm the API is running.
          </Text>
        </View>
      ) : (
        <>
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-6">
            <View className="flex-row gap-2 mb-3">
              {([
                { id: "week", label: "This week" },
                { id: "month", label: "This month" },
                { id: "all", label: "All time" },
              ] as const).map((option) => {
                const active = dateRange === option.id;
                return (
                  <Pressable
                    key={option.id}
                    className={`px-3 py-1.5 rounded-full border ${
                      active
                        ? "bg-primary-600 border-primary-600"
                        : "bg-canvas border-ink-faint"
                    }`}
                    onPress={() => setDateRange(option.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter earnings by ${option.label}`}
                  >
                    <Text className={`text-xs font-semibold ${active ? "text-white" : "text-ink-soft"}`}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-3">
              Earnings Summary
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-canvas rounded-xl border border-ink-faint p-3">
                <Text className="text-ink-muted text-xs mb-1">Total earnings</Text>
                <Text className="text-ink font-bold text-lg">{formatMoney(totalEarnings, "USD")}</Text>
              </View>
              <View className="flex-1 bg-canvas rounded-xl border border-ink-faint p-3">
                <Text className="text-ink-muted text-xs mb-1">Completed services</Text>
                <Text className="text-ink font-bold text-lg">{completedCount}</Text>
              </View>
            </View>
            <View className="mt-3 bg-canvas rounded-xl border border-ink-faint p-3 flex-row items-center gap-2">
              <Ionicons name="wallet-outline" size={16} color={appColors.primary[600]} />
              <Text className="text-ink-soft text-sm">
                Average payout: <Text className="font-semibold text-ink">{formatMoney(averagePayout, "USD")}</Text>
              </Text>
            </View>
            <View className="mt-3 bg-canvas rounded-xl border border-ink-faint p-3">
              <Text className="text-ink-muted text-xs mb-2">Payout status breakdown</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-green-700 text-sm font-semibold">Paid</Text>
                <Text className="text-ink text-sm font-semibold">
                  {completedCount} ({formatMoney(totalEarnings, "USD")})
                </Text>
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-amber-700 text-sm font-semibold">Pending</Text>
                <Text className="text-ink text-sm font-semibold">
                  {pendingCount} ({formatMoney(pendingAmount, payoutCurrency)})
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink">Payout History</Text>
            <Text className="text-ink-muted text-xs">
              {filteredPayouts.length} payout{filteredPayouts.length === 1 ? "" : "s"}
            </Text>
          </View>

          {filteredPayouts.length === 0 ? (
            <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-6 items-center">
              <Ionicons name="cash-outline" size={28} color={appColors.ink.subtle} />
              <Text className="text-ink font-semibold text-base mt-3 mb-1">No payouts yet</Text>
              <Text className="text-ink-muted text-sm text-center">
                No completed payouts in this date range yet.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {filteredPayouts.map((row) => {
                const customerName = `${row.customerFirstName} ${row.customerLastName}`.trim();
                return (
                  <Pressable
                    key={row.id}
                    className="bg-canvas-raised border border-ink-faint rounded-2xl p-4"
                    onPress={() => router.push(`/(provider)/booking/${row.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open booking details for ${row.serviceTitle}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-ink font-semibold text-base">{row.serviceTitle}</Text>
                        <Text className="text-ink-muted text-xs mt-0.5">{customerName}</Text>
                      </View>
                      <Text className="text-primary-600 font-bold text-base">
                        {formatMoney(row.totalAmount, row.totalCurrency)}
                      </Text>
                    </View>
                    <View className="mt-3 pt-3 border-t border-ink-faint flex-row items-center justify-between">
                      <Text className="text-ink-subtle text-xs">{formatDate(row.updatedAt)}</Text>
                      <Text className="text-green-700 text-xs font-semibold">Paid</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
