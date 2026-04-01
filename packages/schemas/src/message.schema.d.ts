import { z } from "zod";
export declare const MessageType: z.ZodEnum<["TEXT", "IMAGE", "SYSTEM"]>;
export type MessageType = z.infer<typeof MessageType>;
export declare const ConversationSchema: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodString;
    customerId: z.ZodString;
    providerId: z.ZodString;
    lastMessageAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    bookingId: string;
    providerId: string;
    customerId: string;
    lastMessageAt?: Date | undefined;
}, {
    id: string;
    createdAt: Date;
    bookingId: string;
    providerId: string;
    customerId: string;
    lastMessageAt?: Date | undefined;
}>;
export declare const MessageSchema: z.ZodObject<{
    id: z.ZodString;
    conversationId: z.ZodString;
    senderId: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["TEXT", "IMAGE", "SYSTEM"]>>;
    content: z.ZodString;
    readAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "TEXT" | "IMAGE" | "SYSTEM";
    id: string;
    createdAt: Date;
    conversationId: string;
    senderId: string;
    content: string;
    readAt?: Date | undefined;
}, {
    id: string;
    createdAt: Date;
    conversationId: string;
    senderId: string;
    content: string;
    type?: "TEXT" | "IMAGE" | "SYSTEM" | undefined;
    readAt?: Date | undefined;
}>;
export declare const SendMessageSchema: z.ZodObject<Pick<{
    id: z.ZodString;
    conversationId: z.ZodString;
    senderId: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["TEXT", "IMAGE", "SYSTEM"]>>;
    content: z.ZodString;
    readAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "type" | "conversationId" | "content">, "strip", z.ZodTypeAny, {
    type: "TEXT" | "IMAGE" | "SYSTEM";
    conversationId: string;
    content: string;
}, {
    conversationId: string;
    content: string;
    type?: "TEXT" | "IMAGE" | "SYSTEM" | undefined;
}>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
