import { Text, TouchableOpacity, View } from "react-native";

import { parseCivilDateKey, type ProviderAvailabilityDay } from "@repo/schemas";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function mondayIndex(dateKey: string): number {
  const { year, month, day } = parseCivilDateKey(dateKey);
  const sundayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayIndex + 6) % 7;
}

function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(-2)));
}

type DayKind = "locked" | "booked" | "open" | "off";

type AvailabilityMonthGridProps = {
  days: ProviderAvailabilityDay[];
  selectedDate?: string;
  onPressDay: (dateKey: string) => void;
  /** When true, closed days stay tappable (provider editor). */
  allowDisabledPress?: boolean;
  /** Saved open days — green and not reschedulable. */
  lockedDates?: string[];
  /** Fully booked open days (customer). */
  bookedDates?: string[];
};

function dayKind(day: ProviderAvailabilityDay, locked: Set<string>, booked: Set<string>): DayKind {
  if (booked.has(day.date)) return "booked";
  if (locked.has(day.date)) return "locked";
  if (day.enabled) return "open";
  return "off";
}

function dayCellClass(kind: DayKind, selected: boolean): string {
  if (kind === "locked") {
    return selected ? "bg-green-200 border-green-700" : "bg-green-100 border-green-500";
  }
  if (kind === "booked") {
    return selected ? "bg-amber-200 border-amber-700" : "bg-amber-100 border-amber-500";
  }
  if (kind === "off") {
    return selected ? "bg-canvas-sunken border-ink-subtle" : "bg-canvas-sunken border-ink-faint";
  }
  return selected ? "bg-primary-50 border-primary-600" : "bg-canvas-raised border-ink-faint";
}

function dayLabelClass(kind: DayKind, selected: boolean): string {
  if (kind === "locked") return selected ? "text-green-900" : "text-green-800";
  if (kind === "booked") return selected ? "text-amber-900" : "text-amber-800";
  if (kind === "off") return "text-ink-subtle";
  return selected ? "text-primary-600" : "text-ink";
}

export function AvailabilityMonthGrid({
  days,
  selectedDate,
  onPressDay,
  allowDisabledPress = false,
  lockedDates = [],
  bookedDates = [],
}: AvailabilityMonthGridProps) {
  const locked = new Set(lockedDates);
  const booked = new Set(bookedDates);
  const leadingBlanks = days[0] ? mondayIndex(days[0].date) : 0;
  const cells: Array<ProviderAvailabilityDay | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  const isEditor = allowDisabledPress;
  const selected = days.find((day) => day.date === selectedDate);
  const selectedKind = selected ? dayKind(selected, locked, booked) : undefined;

  return (
    <View>
      <View className="gap-1.5 mb-3 px-0.5">
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded-sm bg-green-100 border border-green-500" />
          <Text className="text-ink-muted text-xs flex-1 leading-4">
            {isEditor
              ? "Green days are already scheduled and cannot be changed."
              : "Green days are open to book."}
          </Text>
        </View>
        {bookedDates.length > 0 ? (
          <View className="flex-row items-center gap-2">
            <View className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-500" />
            <Text className="text-ink-muted text-xs flex-1 leading-4">Amber days are fully booked.</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row mb-2">
        {WEEKDAYS.map((label) => (
          <Text key={label} className="flex-1 text-center text-ink-muted text-xs font-semibold">
            {label}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`blank-${index}`} className="w-[14.28%] aspect-square p-0.5" />;
          }
          const kind = dayKind(day, locked, booked);
          const isSelected = selectedDate === day.date;
          const tappable =
            kind === "locked"
              ? true
              : kind === "booked"
                ? false
                : day.enabled || allowDisabledPress;
          return (
            <View key={day.date} className="w-[14.28%] aspect-square p-0.5">
              <TouchableOpacity
                className={`flex-1 rounded-xl items-center justify-center border ${dayCellClass(kind, isSelected)}`}
                disabled={!tappable}
                onPress={() => onPressDay(day.date)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !tappable, selected: isSelected }}
                accessibilityLabel={`${day.date}${
                  kind === "booked"
                    ? " fully booked"
                    : kind === "locked"
                      ? " already scheduled"
                      : day.enabled
                        ? " open"
                        : " not scheduled"
                }`}
              >
                <Text className={`text-sm font-semibold ${dayLabelClass(kind, isSelected)}`}>
                  {dayNumber(day.date)}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {selected && selectedKind ? (
        <Text
          className={`text-sm font-medium mt-3 ${
            selectedKind === "locked"
              ? "text-green-800"
              : selectedKind === "booked"
                ? "text-amber-800"
                : selected.enabled
                  ? "text-primary-700"
                  : "text-ink-muted"
          }`}
        >
          {selectedKind === "booked"
            ? "This day is fully booked."
            : selectedKind === "locked" && isEditor
              ? "This day is already scheduled and cannot be changed."
              : selected.enabled || selectedKind === "locked"
                ? "This day is open for bookings."
                : "This day is not scheduled yet."}
        </Text>
      ) : null}
    </View>
  );
}
