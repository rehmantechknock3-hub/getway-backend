"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateServiceSchema = exports.ServiceSchema = exports.ServiceCategorySchema = exports.UpdateProviderProfileSchema = exports.ProviderProfileSchema = exports.VerificationStatus = void 0;
const zod_1 = require("zod");
exports.VerificationStatus = zod_1.z.enum([
    "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED",
]);
exports.ProviderProfileSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    bio: zod_1.z.string().max(500).optional(),
    verificationStatus: exports.VerificationStatus.default("PENDING"),
    isOnline: zod_1.z.boolean().default(false),
    averageRating: zod_1.z.number().min(0).max(5).default(0),
    totalReviews: zod_1.z.number().int().default(0),
    totalEarnings: zod_1.z.number().default(0),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
exports.UpdateProviderProfileSchema = exports.ProviderProfileSchema.pick({
    bio: true,
    isOnline: true,
    latitude: true,
    longitude: true,
}).partial();
exports.ServiceCategorySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    icon: zod_1.z.string(),
    description: zod_1.z.string().optional(),
});
exports.ServiceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    providerId: zod_1.z.string().uuid(),
    categoryId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive(),
    duration: zod_1.z.number().int().positive(),
    isActive: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
exports.CreateServiceSchema = exports.ServiceSchema.pick({
    categoryId: true,
    title: true,
    description: true,
    price: true,
    duration: true,
});
//# sourceMappingURL=provider.schema.js.map