"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserSchema = exports.CreateUserSchema = exports.UserSchema = exports.UserRole = void 0;
const zod_1 = require("zod");
exports.UserRole = zod_1.z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]);
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    clerkId: zod_1.z.string(),
    role: exports.UserRole,
    email: zod_1.z.string().email(),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    phone: zod_1.z.string().optional(),
    avatarUrl: zod_1.z.string().url().optional(),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
exports.CreateUserSchema = exports.UserSchema.pick({
    clerkId: true,
    role: true,
    email: true,
    firstName: true,
    lastName: true,
});
exports.UpdateUserSchema = exports.UserSchema.pick({
    firstName: true,
    lastName: true,
    phone: true,
    avatarUrl: true,
}).partial();
//# sourceMappingURL=user.schema.js.map