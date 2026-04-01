import { z } from "zod";

export const MessageType = z.enum(["TEXT", "IMAGE", "SYSTEM"]);
export type MessageType = z.infer<typeof MessageType>;

export const ConversationSchema = z.object({
  id:           z.string().uuid(),
  bookingId:    z.string().uuid(),
  customerId:   z.string().uuid(),
  providerId:   z.string().uuid(),
  lastMessageAt: z.coerce.date().optional(),
  createdAt:    z.coerce.date(),
});

export const MessageSchema = z.object({
  id:             z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId:       z.string().uuid(),
  type:           MessageType.default("TEXT"),
  content:        z.string().min(1).max(2000),
  readAt:         z.coerce.date().optional(),
  createdAt:      z.coerce.date(),
});

export const SendMessageSchema = MessageSchema.pick({
  conversationId: true,
  type:           true,
  content:        true,
});

export type Conversation     = z.infer<typeof ConversationSchema>;
export type Message          = z.infer<typeof MessageSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
