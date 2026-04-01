import { View, Text } from "react-native";

export default function MessagesScreen() {
  return (
    <View className="flex-1 bg-gray-50 items-center justify-center">
      <Text className="text-xl font-semibold text-gray-900">Messages</Text>
      <Text className="text-gray-500 mt-2">Real-time chat — M4</Text>
    </View>
  );
}
