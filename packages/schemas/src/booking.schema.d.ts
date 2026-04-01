import { z } from "zod";
export declare const BookingStatus: z.ZodEnum<["PENDING", "ACCEPTED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>;
export type BookingStatus = z.infer<typeof BookingStatus>;
export declare const BookingSchema: z.ZodObject<{
    id: z.ZodString;
    customerId: z.ZodString;
    providerId: z.ZodString;
    serviceId: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["PENDING", "ACCEPTED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>>;
    scheduledAt: z.ZodDate;
    address: z.ZodString;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    latitude: number;
    longitude: number;
    providerId: string;
    customerId: string;
    serviceId: string;
    scheduledAt: Date;
    address: string;
    totalAmount: number;
    notes?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    latitude: number;
    longitude: number;
    providerId: string;
    customerId: string;
    serviceId: string;
    scheduledAt: Date;
    address: string;
    totalAmount: number;
    status?: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
    notes?: string | undefined;
}>;
export declare const CreateBookingSchema: z.ZodObject<Pick<{
    id: z.ZodString;
    customerId: z.ZodString;
    providerId: z.ZodString;
    serviceId: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["PENDING", "ACCEPTED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>>;
    scheduledAt: z.ZodDate;
    address: z.ZodString;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "latitude" | "longitude" | "serviceId" | "scheduledAt" | "address" | "notes">, "strip", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
    serviceId: string;
    scheduledAt: Date;
    address: string;
    notes?: string | undefined;
}, {
    latitude: number;
    longitude: number;
    serviceId: string;
    scheduledAt: Date;
    address: string;
    notes?: string | undefined;
}>;
export declare const UpdateBookingStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["PENDING", "ACCEPTED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}, {
    status: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}>;
export declare const BookingListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        customerId: z.ZodString;
        providerId: z.ZodString;
        serviceId: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["PENDING", "ACCEPTED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]>>;
        scheduledAt: z.ZodDate;
        address: z.ZodString;
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
        totalAmount: z.ZodNumber;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
        latitude: number;
        longitude: number;
        providerId: string;
        customerId: string;
        serviceId: string;
        scheduledAt: Date;
        address: string;
        totalAmount: number;
        notes?: string | undefined;
    }, {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        latitude: number;
        longitude: number;
        providerId: string;
        customerId: string;
        serviceId: string;
        scheduledAt: Date;
        address: string;
        totalAmount: number;
        status?: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
        notes?: string | undefined;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    limit: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    data: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
        latitude: number;
        longitude: number;
        providerId: string;
        customerId: string;
        serviceId: string;
        scheduledAt: Date;
        address: string;
        totalAmount: number;
        notes?: string | undefined;
    }[];
    total: number;
    page: number;
    limit: number;
}, {
    data: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        latitude: number;
        longitude: number;
        providerId: string;
        customerId: string;
        serviceId: string;
        scheduledAt: Date;
        address: string;
        totalAmount: number;
        status?: "PENDING" | "REJECTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
        notes?: string | undefined;
    }[];
    total: number;
    page: number;
    limit: number;
}>;
export declare const ReviewSchema: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodString;
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    bookingId: string;
    rating: number;
    comment?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    bookingId: string;
    rating: number;
    comment?: string | undefined;
}>;
export declare const CreateReviewSchema: z.ZodObject<Pick<{
    id: z.ZodString;
    bookingId: z.ZodString;
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
}, "bookingId" | "rating" | "comment">, "strip", z.ZodTypeAny, {
    bookingId: string;
    rating: number;
    comment?: string | undefined;
}, {
    bookingId: string;
    rating: number;
    comment?: string | undefined;
}>;
export type Booking = z.infer<typeof BookingSchema>;
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
