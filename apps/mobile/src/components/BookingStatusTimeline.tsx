import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Booking } from "@repo/schemas";
import { appColors } from "../styles/colors";

type StepState = "done" | "current" | "upcoming";

export type BookingTimelineAudience = "customer" | "provider";

const CUSTOMER_STEPS: Array<{ label: string; hint: string }> = [
  { label: "Request sent", hint: "Your booking request was submitted." },
  { label: "Provider on the way", hint: "The provider accepted and is heading to your location." },
  { label: "Service started", hint: "Work is underway at your location." },
  { label: "Completed", hint: "This job is finished." },
];

const PROVIDER_STEPS: Array<{ label: string; hint: string }> = [
  { label: "Request received", hint: "The customer booked your service and is waiting for your response." },
  { label: "You confirmed", hint: "You accepted this booking and scheduled the visit." },
  { label: "Service in progress", hint: "Work is underway at the customer's location." },
  { label: "Completed", hint: "This job is finished." },
];

function stepsForAudience(audience: BookingTimelineAudience) {
  return audience === "provider" ? PROVIDER_STEPS : CUSTOMER_STEPS;
}

function stepStatesForStatus(status: Booking["status"]): StepState[] {
  switch (status) {
    case "PENDING":
      return ["done", "current", "upcoming", "upcoming"];
    case "ACCEPTED":
      return ["done", "done", "upcoming", "upcoming"];
    case "IN_PROGRESS":
      return ["done", "done", "current", "upcoming"];
    case "COMPLETED":
      return ["done", "done", "done", "done"];
    case "REJECTED":
      return ["done", "upcoming", "upcoming", "upcoming"];
    case "CANCELLED":
      return ["upcoming", "upcoming", "upcoming", "upcoming"];
  }
}

function StepDot({ state }: { state: StepState }) {
  const ring =
    state === "done"
      ? "bg-primary-500 border-primary-600"
      : state === "current"
        ? "bg-canvas-raised border-primary-500 border-2"
        : "bg-canvas-sunken border-ink-faint border";

  return (
    <View className={`w-9 h-9 rounded-full items-center justify-center ${ring}`}>
      {state === "done" ? (
        <Ionicons name="checkmark" size={18} color={appColors.onPrimary} />
      ) : state === "current" ? (
        <View className="w-2.5 h-2.5 rounded-full bg-primary-500" />
      ) : null}
    </View>
  );
}

export function BookingStatusTimeline({
  status,
  audience = "customer",
}: {
  status: Booking["status"];
  audience?: BookingTimelineAudience;
}) {
  const steps = stepsForAudience(audience);

  if (status === "REJECTED") {
    return (
      <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4">
        <Text className="text-ink font-semibold text-base mb-1">Booking status</Text>
        <Text className="text-ink-muted text-sm mb-4">
          {audience === "provider"
            ? "Track this job from the customer's request through completion."
            : "Track your request from submission through completion."}
        </Text>
        <View className="flex-row">
          <View className="items-center mr-3">
            <StepDot state="done" />
            <View className="w-0.5 h-5 bg-red-200 my-1" />
            <View className="w-9 h-9 rounded-full bg-red-100 items-center justify-center border border-red-200">
              <Ionicons name="close" size={18} color={appColors.semantic.destructive} />
            </View>
          </View>
          <View className="flex-1 pt-1">
            <Text className="text-ink font-semibold text-sm">{steps[0]?.label}</Text>
            <Text className="text-ink-muted text-xs mt-0.5 mb-6">{steps[0]?.hint}</Text>
            {audience === "provider" ? (
              <>
                <Text className="text-red-800 font-semibold text-sm">You declined this booking</Text>
                <Text className="text-ink-muted text-xs mt-0.5 leading-4">
                  The customer was notified. They can book another time or choose a different provider.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-red-800 font-semibold text-sm">Declined by provider</Text>
                <Text className="text-ink-muted text-xs mt-0.5 leading-4">
                  The provider did not accept this booking. You can book another time or choose a different provider.
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (status === "CANCELLED") {
    return (
      <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4">
        <Text className="text-ink font-semibold text-base mb-1">Booking status</Text>
        <View className="bg-ink-faint rounded-xl px-3 py-2.5 mb-4 flex-row items-center gap-2">
          <Ionicons name="ban-outline" size={20} color={appColors.ink.soft} />
          <Text className="text-ink-soft text-sm flex-1 leading-5">
            This booking was cancelled. It will not move forward.
          </Text>
        </View>
        <Text className="text-ink-muted text-xs leading-4">
          {audience === "provider"
            ? "Cancelled jobs stay in your queue for your records."
            : "Cancelled visits stay in your history for your records."}
        </Text>
      </View>
    );
  }

  const states = stepStatesForStatus(status);

  return (
    <View className="bg-canvas-raised rounded-2xl border border-ink-faint p-4">
      <Text className="text-ink font-semibold text-base mb-1">
        {audience === "provider" ? "Track this job" : "Track this booking"}
      </Text>
      <Text className="text-ink-muted text-sm mb-4">
        {audience === "provider"
          ? "From the customer's request through to completion."
          : "From your request through to completion."}
      </Text>
      {steps.map((step, index) => {
        const state = states[index] ?? "upcoming";
        const isLast = index === steps.length - 1;
        const nextState = !isLast ? (states[index + 1] ?? "upcoming") : null;
        const lineClass =
          state === "done" && (nextState === "done" || nextState === "current")
            ? "bg-primary-500"
            : state === "done" && nextState === "upcoming"
              ? "bg-primary-200"
              : "bg-ink-faint";

        return (
          <View key={step.label} className="flex-row">
            <View className="items-center mr-3 w-9">
              <StepDot state={state} />
              {!isLast ? <View className={`w-0.5 h-10 ${lineClass}`} /> : null}
            </View>
            <View className={`flex-1 ${isLast ? "" : "pb-2"}`}>
              <Text
                className={`text-sm font-semibold ${
                  state === "upcoming" ? "text-ink-muted" : "text-ink"
                }`}
              >
                {step.label}
              </Text>
              <Text className="text-ink-muted text-xs mt-0.5 leading-4 pr-2">{step.hint}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Compact row of dots for list cards (happy path + terminal colors). */
export function BookingStatusProgressDots({ status }: { status: Booking["status"] }) {
  if (status === "REJECTED" || status === "CANCELLED") {
    return (
      <View className="flex-row items-center gap-1.5 mt-2">
        <View className="h-1 flex-1 rounded-full bg-ink-faint" />
        <Text className="text-ink-subtle text-xs font-medium uppercase tracking-wide">
          {status === "REJECTED" ? "Declined" : "Cancelled"}
        </Text>
      </View>
    );
  }

  const states = stepStatesForStatus(status);
  return (
    <View className="flex-row items-center gap-1.5 mt-2">
      {states.map((s, i) => (
        <View
          key={i}
          className={`h-1 flex-1 rounded-full ${
            s === "done"
              ? "bg-primary-500"
              : s === "current"
                ? "bg-primary-200"
                : "bg-ink-faint"
          }`}
        />
      ))}
    </View>
  );
}
