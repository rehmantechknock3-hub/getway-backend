import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import { setAuthToken, useBooking, useCreateReview } from "@repo/api-client";
import type { BookingWithReview } from "@repo/schemas";

import { BookingStatusTimeline } from "../../../components/BookingStatusTimeline";
import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d instanceof Date ? d : new Date(d));
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending provider response";
    case "ACCEPTED":
      return "Accepted — visit scheduled";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Declined";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function CustomerReviewBlock({ booking }: { booking: BookingWithReview }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const createReview = useCreateReview();

  useEffect(() => {
    setRating(0);
    setComment("");
  }, [booking.id, booking.review?.id]);

  if (booking.status !== "COMPLETED") {
    return null;
  }

  const submitted = booking.review;
  if (submitted) {
    return (
      <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4 mt-4">
        <Text className="text-ink font-semibold text-base mb-3">Your review</Text>
        <View className="flex-row items-center gap-1 mb-2">
          {STAR_VALUES.map((v) => (
            <Ionicons
              key={v}
              name={v <= submitted.rating ? "star" : "star-outline"}
              size={22}
              color={appColors.semantic.warning}
            />
          ))}
        </View>
        {submitted.comment ? (
          <Text className="text-ink-soft text-sm leading-5">{submitted.comment}</Text>
        ) : (
          <Text className="text-ink-muted text-sm italic">No written comment</Text>
        )}
      </View>
    );
  }

  const submitReview = async () => {
    if (rating < 1) return;
    try {
      await createReview.mutateAsync({
        bookingId: booking.id,
        rating,
        comment: comment.trim().length > 0 ? comment.trim() : undefined,
      });
      Alert.alert("Thanks!", "Your review helps other customers choose great providers.");
    } catch {
      Alert.alert("Could not submit review", "Check your connection and try again.");
    }
  };

  return (
    <View className="bg-canvas-raised rounded-2xl border border-primary-100 p-4 mt-4">
      <Text className="text-ink font-semibold text-base mb-1">Rate this visit</Text>
      <Text className="text-ink-muted text-sm mb-4 leading-5">
        How did your completed service go? Your rating and optional feedback appear on the provider’s profile.
      </Text>
      <Text className="text-ink-soft text-xs font-semibold uppercase tracking-wide mb-2">Tap a star</Text>
      <View className="flex-row items-center gap-2 mb-4">
        {STAR_VALUES.map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => setRating(v)}
            accessibilityRole="button"
            accessibilityLabel={`${v} star${v === 1 ? "" : "s"}`}
            accessibilityState={{ selected: rating === v }}
          >
            <Ionicons
              name={v <= rating ? "star" : "star-outline"}
              size={36}
              color={v <= rating ? appColors.semantic.warning : appColors.ink.subtle}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text className="text-ink-soft text-xs font-semibold uppercase tracking-wide mb-2">
        Comment (optional)
      </Text>
      <TextInput
        className="bg-canvas border border-ink-faint rounded-xl px-3 py-3 text-ink text-sm min-h-[88px]"
        placeholder="Share what went well or what could improve…"
        placeholderTextColor={appColors.ink.subtle}
        style={textInputBaselineStyle}
        multiline
        textAlignVertical="top"
        value={comment}
        onChangeText={setComment}
        maxLength={1000}
        accessibilityLabel="Optional review comment"
      />
      <TouchableOpacity
        className={`mt-4 rounded-xl py-3.5 items-center ${
          rating < 1 || createReview.isPending ? "bg-ink-faint" : "bg-primary-600"
        }`}
        disabled={rating < 1 || createReview.isPending}
        onPress={() => void submitReview()}
        accessibilityRole="button"
        accessibilityLabel="Submit review"
      >
        <Text
          className={`font-bold text-sm ${
            rating < 1 || createReview.isPending ? "text-ink-muted" : "text-white"
          }`}
        >
          {createReview.isPending ? "Submitting…" : "Submit review"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = typeof id === "string" ? id : "";
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [apiReady, setApiReady] = useState(false);

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

  const enabled = isLoaded && isSignedIn && apiReady && !!bookingId;
  const { data: booking, isLoading, isError } = useBooking(bookingId, { enabled });

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom + 28, 40),
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-2xl font-bold text-ink mb-1" style={{ letterSpacing: -0.5 }}>
        Booking details
      </Text>
      {booking ? (
        <Text className="text-ink-muted text-sm mb-6">{statusLabel(booking.status)}</Text>
      ) : (
        <View className="mb-6 h-[18px]" />
      )}

      {!enabled || isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : isError || !booking ? (
        <View className="bg-canvas-raised rounded-2xl p-6 border border-ink-faint">
          <Text className="text-ink text-center font-medium">
            Could not load this booking. It may have been removed or you may not have access.
          </Text>
        </View>
      ) : (
        <>
          <BookingStatusTimeline status={booking.status} />

          <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4 mt-4">
            <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
              Scheduled time
            </Text>
            <Text className="text-ink font-bold text-lg">{formatWhen(booking.scheduledAt)}</Text>
            <View className="flex-row items-start gap-2 mt-4">
              <Ionicons name="location-outline" size={20} color={appColors.ink.muted} />
              <Text className="text-ink-soft text-sm flex-1 leading-5">{booking.address}</Text>
            </View>
            {booking.notes ? (
              <Text className="text-ink-muted text-sm mt-3 leading-5 italic">
                &ldquo;{booking.notes}&rdquo;
              </Text>
            ) : null}
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-ink-faint">
              <Text className="text-ink-subtle text-sm">Total</Text>
              <Text className="text-primary-600 font-bold text-xl">{formatMoney(booking.totalAmount)}</Text>
            </View>
          </View>

          <CustomerReviewBlock booking={booking} />
        </>
      )}
    </ScrollView>
  );
}
