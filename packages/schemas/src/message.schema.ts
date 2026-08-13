import { z } from "zod";

export const MessageType = z.enum(["TEXT", "IMAGE", "SYSTEM"]);
export type MessageType = z.infer<typeof MessageType>;

export const ConversationSchema = z.object({
  id:            z.string().uuid(),
  bookingId:     z.string().uuid(),
  customerId:    z.string().uuid(),
  providerId:    z.string().uuid(),
  lastMessageAt: z.coerce.date().optional(),
  createdAt:     z.coerce.date(),
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

export const ConversationListItemSchema = ConversationSchema.extend({
  otherPartyFirstName:  z.string(),
  otherPartyLastName:   z.string(),
  otherPartyAvatarUrl:  z.string().nullable().optional(),
  lastMessageContent:   z.string().nullable().optional(),
  lastMessageSenderId:  z.string().uuid().nullable().optional(),
  unreadCount:          z.number().int().default(0),
});

export const SendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content:        z.string().min(1).max(2000),
  type:           MessageType.optional().default("TEXT"),
});

/** Body for POST /messages/conversations/:conversationId/messages */
export const SendMessageBodySchema = z.object({
  content: z.string().min(1).max(2000),
  type:    MessageType.optional().default("TEXT"),
});

export const MessageListResponseSchema = z.object({
  data:  z.array(MessageSchema),
  total: z.number().int(),
  page:  z.number().int(),
  limit: z.number().int(),
});

export type Conversation         = z.infer<typeof ConversationSchema>;
export type Message              = z.infer<typeof MessageSchema>;
export type ConversationListItem = z.infer<typeof ConversationListItemSchema>;
export type SendMessageInput     = z.infer<typeof SendMessageSchema>;
export type SendMessageBody      = z.infer<typeof SendMessageBodySchema>;
export type MessageListResponse  = z.infer<typeof MessageListResponseSchema>;
