import { Text, TouchableOpacity, View, type ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ConversationListItem } from "@repo/schemas";

import { ChatAvatar } from "./ChatAvatar";
import { appColors } from "../styles/colors";

export function timeAgo(date: Date | string | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function ConversationCard({
  item,
  myUserId,
  onPress,
  avatarSource,
}: {
  item: ConversationListItem;
  myUserId: string;
  onPress: () => void;
  avatarSource?: ImageSourcePropType;
}) {
  const name = `${item.otherPartyFirstName} ${item.otherPartyLastName}`.trim();
  const isMine = item.lastMessageSenderId === myUserId;
  const unread = item.unreadCount > 0;
  const preview = item.lastMessageContent
    ? `${isMine ? "You: " : ""}${item.lastMessageContent}`
    : "No messages yet";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className={`flex-row items-center overflow-hidden rounded-2xl border px-3.5 py-3.5 ${
        unread
          ? "bg-primary-50 border-primary-100"
          : "bg-canvas-raised border-ink-faint"
      }`}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}`}
    >
      {unread ? <View className="absolute bottom-0 left-0 top-0 w-1 bg-primary-600" /> : null}

      <View className="mr-3">
        <View className={`rounded-full p-0.5 ${unread ? "bg-primary-200" : "bg-primary-50"}`}>
          <ChatAvatar
            uri={item.otherPartyAvatarUrl}
            source={avatarSource}
            name={name || item.otherPartyFirstName}
            size="lg"
          />
        </View>
      </View>

      <View className="min-w-0 flex-1">
        <View className="mb-1 flex-row items-center justify-between">
          <Text
            className={`mr-2 flex-1 text-sm ${unread ? "font-bold text-ink" : "font-semibold text-ink"}`}
            numberOfLines={1}
          >
            {name}
          </Text>
          {item.lastMessageAt ? (
            <View className={`rounded-full px-2 py-0.5 ${unread ? "bg-primary-100" : "bg-canvas-sunken"}`}>
              <Text className={`text-xs ${unread ? "font-semibold text-primary-700" : "text-ink-muted"}`}>
                {timeAgo(item.lastMessageAt)}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center justify-between">
          <Text
            className={`mr-2 flex-1 text-sm ${unread ? "font-medium text-ink-soft" : "text-ink-muted"}`}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread ? (
            <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5">
              <Text className="text-xs font-bold text-white">
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={appColors.ink.subtle} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
