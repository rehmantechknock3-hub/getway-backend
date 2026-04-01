import { z } from "zod";

export const UserRole = z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  id:          z.string().uuid(),
  clerkId:     z.string(),
  role:        UserRole,
  email:       z.string().email(),
  firstName:   z.string().min(1),
  lastName:    z.string().min(1),
  phone:       z.string().optional(),
  avatarUrl:   z.string().url().optional(),
  createdAt:   z.coerce.date(),
  updatedAt:   z.coerce.date(),
});

export const CreateUserSchema = UserSchema.pick({
  clerkId: true,
  role:    true,
  email:   true,
  firstName: true,
  lastName:  true,
});

export const UpdateUserSchema = UserSchema.pick({
  firstName:  true,
  lastName:   true,
  phone:      true,
  avatarUrl:  true,
}).partial();

export type User             = z.infer<typeof UserSchema>;
export type CreateUserInput  = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput  = z.infer<typeof UpdateUserSchema>;
