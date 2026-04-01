import { View, Text, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

type JobStatus = "pending" | "confirmed" | "in_progress";

const STATS = [
  { label: "Pending",   value: "3",    icon: "time-outline",        color: "#F59E0B" },
  { label: "Today",     value: "2",    icon: "calendar-outline",    color: "#3B82F6" },
  { label: "Rating",    value: "4.9",  icon: "star-outline",        color: "#10B981" },
  { label: "Earnings",  value: "$284", icon: "cash-outline",        color: "#8B5CF6" },
];

const JOBS: {
  id: string;
  customer: string;
  service: string;
  address: string;
  time: string;
  price: string;
  status: JobStatus;
}[] = [
  {
    id: "1",
    customer: "Alex Johnson",
    service:  "Deep House Cleaning",
    address:  "124 Maple Street, Apt 3B",
    time:     "Today, 2:00 PM",
    price:    "$120",
    status:   "pending",
  },
  {
    id: "2",
    customer: "Sarah Williams",
    service:  "Bathroom Deep Clean",
    address:  "88 Oak Avenue",
    time:     "Today, 5:00 PM",
    price:    "$75",
    status:   "confirmed",
  },
  {
    id: "3",
    customer: "David Park",
    service:  "Full Home Cleaning",
    address:  "301 Pine Road, Suite 12",
    time:     "Tomorrow, 10:00 AM",
    price:    "$200",
    status:   "pending",
  },
  {
    id: "4",
    customer: "Lisa Chen",
    service:  "Kitchen Deep Clean",
    address:  "15 Elm Street",
    time:     "Tomorrow, 3:00 PM",
    price:    "$90",
    status:   "in_progress",
  },
];

const STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; text: string }> = {
  pending:     { label: "New",         bg: "bg-amber-100",  text: "text-amber-700"  },
  confirmed:   { label: "Confirmed",   bg: "bg-blue-100",   text: "text-blue-700"   },
  in_progress: { label: "In Progress", bg: "bg-green-100",  text: "text-green-700"  },
};

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const { sessionClaims } = useAuth();
  const firstName = (sessionClaims?.firstName as string) ?? "there";

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 90, 100),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 mb-6">
          <View>
            <Text className="text-ink-muted text-sm">Hello,</Text>
            <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {firstName} ⚡
            </Text>
          </View>
          <TouchableOpacity className="w-11 h-11 rounded-full bg-canvas-raised border border-ink-faint items-center justify-center">
            <Ionicons name="notifications-outline" size={22} color="#1C1917" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10, marginBottom: 24 }}
        >
          {STATS.map(({ label, value, icon, color }) => (
            <View key={label} className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 items-center gap-1" style={{ minWidth: 88 }}>
              <Ionicons name={icon as any} size={20} color={color} />
              <Text className="text-xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>{value}</Text>
              <Text className="text-ink-subtle text-xs">{label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Section header */}
        <View className="flex-row items-center justify-between px-5 mb-4">
          <Text className="text-lg font-bold text-ink">Job Queue</Text>
          <View className="bg-primary-100 px-2.5 py-1 rounded-full">
            <Text className="text-primary-700 text-xs font-bold">{JOBS.length} jobs</Text>
          </View>
        </View>

        {/* Job cards */}
        <View className="px-5 gap-3">
          {JOBS.map((job) => {
            const cfg = STATUS_CONFIG[job.status];
            const isPending = job.status === "pending";
            return (
              <View key={job.id} className="bg-canvas-raised rounded-3xl border border-ink-faint overflow-hidden">
                {/* Card header */}
                <View className="flex-row items-start justify-between p-4 pb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-ink font-bold text-base">{job.service}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <Ionicons name="person-outline" size={13} color="#78716C" />
                      <Text className="text-ink-muted text-sm">{job.customer}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="location-outline" size={13} color="#78716C" />
                      <Text className="text-ink-subtle text-xs flex-1" numberOfLines={1}>{job.address}</Text>
                    </View>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${cfg.bg}`}>
                    <Text className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Divider */}
                <View className="h-px bg-ink-faint mx-4" />

                {/* Card footer */}
                <View className="flex-row items-center justify-between px-4 py-3">
                  <View className="flex-row items-center gap-3">
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="time-outline" size={14} color="#78716C" />
                      <Text className="text-ink-muted text-xs">{job.time}</Text>
                    </View>
                  </View>
                  <Text className="text-primary-600 font-bold text-base">{job.price}</Text>
                </View>

                {/* Action buttons (pending only) */}
                {isPending && (
                  <View className="flex-row gap-3 px-4 pb-4">
                    <TouchableOpacity
                      activeOpacity={0.85}
                      className="flex-1 border border-ink-faint rounded-xl py-2.5 items-center"
                    >
                      <Text className="text-ink-soft font-semibold text-sm">Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      className="flex-1 bg-primary-600 rounded-xl py-2.5 items-center"
                    >
                      <Text className="text-white font-semibold text-sm">Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
