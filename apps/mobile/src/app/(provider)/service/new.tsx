import { useEffect, useState } from "react";

import { View } from "react-native";
import { useAuth } from "@clerk/expo";

import { setAuthToken } from "@repo/api-client";

import { ProviderServiceForm } from "../../../components/ProviderServiceForm";

export default function ProviderNewServiceScreen() {
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

  return (
    <View className="flex-1 bg-canvas">
      <ProviderServiceForm mode="new" enabled={enabled} />
    </View>
  );
}
