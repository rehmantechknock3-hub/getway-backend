import { z } from "zod";
export declare const VerificationStatus: z.ZodEnum<["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]>;
export type VerificationStatus = z.infer<typeof VerificationStatus>;
export declare const ProviderProfileSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    bio: z.ZodOptional<z.ZodString>;
    verificationStatus: z.ZodDefault<z.ZodEnum<["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]>>;
    isOnline: z.ZodDefault<z.ZodBoolean>;
    averageRating: z.ZodDefault<z.ZodNumber>;
    totalReviews: z.ZodDefault<z.ZodNumber>;
    totalEarnings: z.ZodDefault<z.ZodNumber>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    verificationStatus: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    isOnline: boolean;
    averageRating: number;
    totalReviews: number;
    totalEarnings: number;
    bio?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    bio?: string | undefined;
    verificationStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | undefined;
    isOnline?: boolean | undefined;
    averageRating?: number | undefined;
    totalReviews?: number | undefined;
    totalEarnings?: number | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}>;
export declare const UpdateProviderProfileSchema: z.ZodObject<{
    bio: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isOnline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    latitude: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    longitude: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    bio?: string | undefined;
    isOnline?: boolean | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}, {
    bio?: string | undefined;
    isOnline?: boolean | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}>;
export declare const ServiceCategorySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    icon: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    icon: string;
    description?: string | undefined;
}, {
    id: string;
    name: string;
    icon: string;
    description?: string | undefined;
}>;
export declare const ServiceSchema: z.ZodObject<{
    id: z.ZodString;
    providerId: z.ZodString;
    categoryId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    duration: z.ZodNumber;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    providerId: string;
    categoryId: string;
    title: string;
    price: number;
    duration: number;
    isActive: boolean;
    description?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    providerId: string;
    categoryId: string;
    title: string;
    price: number;
    duration: number;
    description?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const CreateServiceSchema: z.ZodObject<Pick<{
    id: z.ZodString;
    providerId: z.ZodString;
    categoryId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    duration: z.ZodNumber;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "description" | "categoryId" | "title" | "price" | "duration">, "strip", z.ZodTypeAny, {
    categoryId: string;
    title: string;
    price: number;
    duration: number;
    description?: string | undefined;
}, {
    categoryId: string;
    title: string;
    price: number;
    duration: number;
    description?: string | undefined;
}>;
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;
export type UpdateProviderProfileInput = z.infer<typeof UpdateProviderProfileSchema>;
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
