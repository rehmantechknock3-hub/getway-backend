import { z } from "zod";
export declare const UserRole: z.ZodEnum<["CUSTOMER", "PROVIDER", "ADMIN"]>;
export type UserRole = z.infer<typeof UserRole>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    clerkId: z.ZodString;
    role: z.ZodEnum<["CUSTOMER", "PROVIDER", "ADMIN"]>;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    clerkId: string;
    email: string;
    role: "CUSTOMER" | "PROVIDER" | "ADMIN";
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    phone?: string | undefined;
    avatarUrl?: string | undefined;
}, {
    id: string;
    clerkId: string;
    email: string;
    role: "CUSTOMER" | "PROVIDER" | "ADMIN";
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    phone?: string | undefined;
    avatarUrl?: string | undefined;
}>;
export declare const CreateUserSchema: z.ZodObject<Pick<{
    id: z.ZodString;
    clerkId: z.ZodString;
    role: z.ZodEnum<["CUSTOMER", "PROVIDER", "ADMIN"]>;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "clerkId" | "email" | "role" | "firstName" | "lastName">, "strip", z.ZodTypeAny, {
    clerkId: string;
    email: string;
    role: "CUSTOMER" | "PROVIDER" | "ADMIN";
    firstName: string;
    lastName: string;
}, {
    clerkId: string;
    email: string;
    role: "CUSTOMER" | "PROVIDER" | "ADMIN";
    firstName: string;
    lastName: string;
}>;
export declare const UpdateUserSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    avatarUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
    avatarUrl?: string | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
    avatarUrl?: string | undefined;
}>;
export type User = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
