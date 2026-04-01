import { View, Text, ScrollView, TouchableOpacity, TextInput, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = [
  { icon: "water",         label: "Plumbing"    },
  { icon: "flash",         label: "Electrical"  },
  { icon: "brush",         label: "Cleaning"    },
  { icon: "construct",     label: "Repairs"     },
  { icon: "leaf",          label: "Gardening"   },
  { icon: "color-palette", label: "Painting"    },
];

const PROVIDERS = [
  { name: "Sarah Mitchell",   service: "Deep Cleaning",  rating: 4.9, reviews: 128, price: "$45/hr",  distance: "0.8 mi",  available: true  },
  { name: "James Rodriguez",  service: "Plumbing",       rating: 4.8, reviews: 94,  price: "$65/hr",  distance: "1.2 mi",  available: true  },
  { name: "Emma Chen",        service: "Electrical",     rating: 5.0, reviews: 61,  price: "$70/hr",  distance: "2.1 mi",  available: false },
  { name: "Marcus Thompson",  service: "Gardening",      rating: 4.7, reviews: 203, price: "$35/hr",  distance: "0.5 mi",  available: true  },
];

export default function HomeScreen() {
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
            <Text className="text-ink-muted text-sm">Good morning,</Text>
            <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {firstName} 👋
            </Text>
          </View>
          <TouchableOpacity className="w-11 h-11 rounded-full bg-canvas-raised border border-ink-faint items-center justify-center">
            <Ionicons name="notifications-outline" size={22} color="#1C1917" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="mx-5 mb-7">
          <View className="flex-row items-center bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 gap-3">
            <Ionicons name="search" size={20} color="#78716C" />
            <TextInput
              className="flex-1 text-ink text-base"
              placeholder="Search services or providers..."
              placeholderTextColor="#A8A29E"
            />
            <TouchableOpacity className="bg-primary-600 rounded-xl px-3 py-1.5">
              <Text className="text-white text-xs font-semibold">Filter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories */}
        <View className="mb-7">
          <View className="flex-row items-center justify-between px-5 mb-4">
            <Text className="text-lg font-bold text-ink">Categories</Text>
            <TouchableOpacity>
              <Text className="text-primary-600 text-sm font-medium">See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {CATEGORIES.map(({ icon, label }) => (
              <TouchableOpacity
                key={label}
                activeOpacity={0.8}
                className="items-center gap-2"
              >
                <View className="w-16 h-16 rounded-2xl bg-canvas-raised border border-ink-faint items-center justify-center">
                  <Ionicons name={icon as any} size={26} color="#E8521A" />
                </View>
                <Text className="text-xs font-medium text-ink-soft">{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Promo banner */}
        <View className="mx-5 mb-7 bg-ink rounded-3xl p-5 flex-row items-center overflow-hidden">
          <View className="flex-1">
            <Text className="text-primary-400 text-xs font-semibold uppercase tracking-wide mb-1">Limited offer</Text>
            <Text className="text-white text-xl font-bold mb-1" style={{ letterSpacing: -0.5 }}>
              First booking{"\n"}20% off
            </Text>
            <TouchableOpacity className="bg-primary-600 self-start rounded-xl px-4 py-2 mt-2">
              <Text className="text-white text-xs font-bold">Book now</Text>
            </TouchableOpacity>
          </View>
          <View className="w-20 h-20 rounded-2xl bg-ink-soft items-center justify-center ml-4">
            <Ionicons name="pricetag" size={36} color="#FF6B35" />
          </View>
        </View>

        {/* Nearby providers */}
        <View className="px-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-ink">Nearby Providers</Text>
            <TouchableOpacity>
              <Text className="text-primary-600 text-sm font-medium">View map</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.name}
                activeOpacity={0.9}
                className="bg-canvas-raised rounded-2xl p-4 border border-ink-faint flex-row items-center gap-4"
              >
                {/* Avatar */}
                <View className="w-14 h-14 rounded-2xl bg-canvas-sunken items-center justify-center">
                  <Text className="text-xl font-bold text-ink-muted">
                    {p.name.split(" ").map((n) => n[0]).join("")}
                  </Text>
                </View>

                {/* Info */}
                <View className="flex-1">
                  <Text className="text-ink font-semibold text-base">{p.name}</Text>
                  <Text className="text-ink-muted text-sm">{p.service}</Text>
                  <View className="flex-row items-center gap-3 mt-1">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text className="text-xs font-medium text-ink-soft">{p.rating} ({p.reviews})</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="location-outline" size={12} color="#A8A29E" />
                      <Text className="text-xs text-ink-subtle">{p.distance}</Text>
                    </View>
                  </View>
                </View>

                {/* Right */}
                <View className="items-end gap-2">
                  <Text className="text-primary-600 font-bold text-sm">{p.price}</Text>
                  <View className={`px-2 py-0.5 rounded-full ${p.available ? "bg-green-100" : "bg-ink-faint"}`}>
                    <Text className={`text-xs font-medium ${p.available ? "text-green-700" : "text-ink-subtle"}`}>
                      {p.available ? "Available" : "Busy"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
