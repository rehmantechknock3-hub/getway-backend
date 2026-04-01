"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendMessageSchema = exports.MessageSchema = exports.ConversationSchema = exports.MessageType = void 0;
const zod_1 = require("zod");
exports.MessageType = zod_1.z.enum(["TEXT", "IMAGE", "SYSTEM"]);
exports.ConversationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    bookingId: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid(),
    providerId: zod_1.z.string().uuid(),
    lastMessageAt: zod_1.z.coerce.date().optional(),
    createdAt: zod_1.z.coerce.date(),
});
exports.MessageSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    conversationId: zod_1.z.string().uuid(),
    senderId: zod_1.z.string().uuid(),
    type: exports.MessageType.default("TEXT"),
    content: zod_1.z.string().min(1).max(2000),
    readAt: zod_1.z.coerce.date().optional(),
    createdAt: zod_1.z.coerce.date(),
});
exports.SendMessageSchema = exports.MessageSchema.pick({
    conversationId: true,
    type: true,
    content: true,
});
//# sourceMappingURL=message.schema.js.map