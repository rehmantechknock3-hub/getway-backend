import { z } from "zod";

export const NotificationType = z.enum([
  "BOOKING_NEW_REQUEST",
  "BOOKING_ACCEPTED",
  "BOOKING_REJECTED",
  "BOOKING_IN_PROGRESS",
  "BOOKING_COMPLETED",
  "BOOKING_CANCELLED",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationSchema = z.object({
  id:        z.string().uuid(),
  userId:    z.string().uuid(),
  type:      z.string(),
  title:     z.string(),
  body:      z.string(),
  readAt:    z.coerce.date().nullable(),
  bookingId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
});

export const NotificationListResponseSchema = z.object({
  data:         z.array(NotificationSchema),
  total:        z.number().int(),
  unreadCount:  z.number().int(),
  page:         z.number().int(),
  limit:        z.number().int(),
});

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
