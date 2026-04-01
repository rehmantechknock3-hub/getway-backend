import { View, Text } from "react-native";
import { useAuth } from "@clerk/expo";
import { Button } from "@repo/ui";

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-6">
      <Text className="text-xl font-semibold text-gray-900 mb-8">Profile</Text>
      <Button label="Sign Out" variant="outline" onPress={() => signOut()} />
    </View>
  );
}
