import { useEffect, useMemo, useState } from "react";

import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

import { setAuthToken, useMyProviderServices } from "@repo/api-client";

import { ProviderServiceForm } from "../../../components/ProviderServiceForm";
import { appColors } from "../../../styles/colors";

export default function ProviderEditServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  const enabled = isLoaded && isSignedIn && apiReady;
  const { data, isLoading, isError } = useMyProviderServices({ enabled });

  const service = useMemo(() => data?.find((s) => s.id === id), [data, id]);

  if (!enabled || isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color={appColors.primary[600]} />
      </View>
    );
  }

  if (isError || !id) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink-muted text-center">Could not load this service.</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink font-semibold text-center mb-2">Service not found</Text>
        <Text className="text-ink-muted text-sm text-center mb-6">
          It may have been removed. Pull to refresh on My services and try again.
        </Text>
        <TouchableOpacity
          className="bg-primary-600 rounded-2xl px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <ProviderServiceForm mode="edit" enabled={enabled} initial={service} />
    </View>
  );
}
