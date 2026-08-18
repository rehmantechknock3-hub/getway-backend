import { Text, View, type ImageSourcePropType } from "react-native";

import type { Message } from "@repo/schemas";

import { ChatAvatar } from "./ChatAvatar";

export type ProcessedMessage = Message & {
  isFirst: boolean;
  isLast: boolean;
};

export function processMessages(msgs: Message[]): ProcessedMessage[] {
  return msgs.map((msg, i) => ({
    ...msg,
    isFirst: !msgs[i - 1] || msgs[i - 1]!.senderId !== msg.senderId,
    isLast: !msgs[i + 1] || msgs[i + 1]!.senderId !== msg.senderId,
  }));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date instanceof Date ? date : new Date(date));
}

export function formatDateLabel(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(d);
}

export function isDifferentDay(a: Date | string, b: Date | string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

/** Soft blobs behind the thread so bubbles sit on a split canvas, not a flat gray. */
export function ChatThreadBackdrop() {
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden bg-canvas-sunken">
      <View className="absolute h-64 w-64 rounded-full bg-primary-50" style={{ top: -36, right: -48 }} />
      <View
        className="absolute h-44 w-44 rounded-full bg-primary-100"
        style={{ top: "36%", left: -40, opacity: 0.45 }}
      />
      <View
        className="absolute h-52 w-52 rounded-full bg-primary-50"
        style={{ bottom: 48, right: -28, opacity: 0.8 }}
      />
    </View>
  );
}

export function DateSeparator({ date }: { date: Date | string }) {
  return (
    <View className="my-3 flex-row items-center justify-center px-4">
      <View className="rounded-full border border-ink-faint bg-canvas-raised px-3 py-1">
        <Text className="text-xs font-medium text-ink-muted">{formatDateLabel(date)}</Text>
      </View>
    </View>
  );
}

export function OutgoingBubble({
  msg,
  avatarUrl,
  name,
}: {
  msg: ProcessedMessage;
  avatarUrl?: string | null;
  name: string;
}) {
  return (
    <View className={`flex-row justify-end pl-14 ${msg.isLast ? "mb-3" : "mb-1"}`}>
      <View className="max-w-[82%] flex-row items-end">
        <View
          className="bg-primary-600 px-3.5 pb-2 pt-2.5"
          style={{
            borderRadius: 18,
            borderBottomRightRadius: msg.isLast ? 6 : 18,
          }}
        >
          <Text className="text-sm leading-5 text-white">{msg.content}</Text>
          <Text className="mt-1 text-right text-xs text-primary-100">{formatTime(msg.createdAt)}</Text>
        </View>
        <View className="ml-1.5 h-7 w-7 flex-shrink-0 items-center justify-center">
          {msg.isLast ? <ChatAvatar uri={avatarUrl} name={name} size="sm" /> : null}
        </View>
      </View>
    </View>
  );
}

export function IncomingBubble({
  msg,
  avatarUrl,
  avatarSource,
  name,
}: {
  msg: ProcessedMessage;
  avatarUrl?: string | null;
  avatarSource?: ImageSourcePropType;
  name: string;
}) {
  return (
    <View className={`flex-row justify-start pr-14 ${msg.isLast ? "mb-3" : "mb-1"}`}>
      <View className="max-w-[82%] flex-row items-end">
        <View className="mr-1.5 h-7 w-7 flex-shrink-0 items-center justify-center">
          {msg.isLast ? (
            <ChatAvatar uri={avatarUrl} source={avatarSource} name={name} size="sm" />
          ) : null}
        </View>
        <View
          className="border border-ink-faint bg-canvas-raised px-3.5 pb-2 pt-2.5"
          style={{
            borderRadius: 18,
            borderBottomLeftRadius: msg.isLast ? 6 : 18,
          }}
        >
          {msg.isFirst ? (
            <Text className="mb-0.5 text-xs font-semibold text-primary-600" numberOfLines={1}>
              {name}
            </Text>
          ) : null}
          <Text className="text-sm leading-5 text-ink">{msg.content}</Text>
          <Text className="mt-1 text-right text-xs text-ink-subtle">{formatTime(msg.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}
