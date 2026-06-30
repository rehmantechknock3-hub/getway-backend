import { View } from "react-native";
import { useAuth } from "@clerk/expo";

import { ProviderServiceForm } from "../../../components/ProviderServiceForm";

export default function ProviderNewServiceScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const enabled = isLoaded && isSignedIn;

  return (
    <View className="flex-1 bg-canvas">
      <ProviderServiceForm mode="new" enabled={enabled} />
    </View>
  );
}
