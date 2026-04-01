/**
 * Platform-agnostic auth hook interface.
 * Each app provides its own implementation via its Clerk SDK.
 * This file documents the contract consumed by shared hooks.
 */
export type AuthUser = {
  id:        string;
  clerkId:   string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      "CUSTOMER" | "PROVIDER" | "ADMIN";
  avatarUrl?: string;
};

export type UseAuthReturn = {
  user:         AuthUser | null;
  isLoaded:     boolean;
  isSignedIn:   boolean;
  getToken:     () => Promise<string | null>;
  signOut:      () => Promise<void>;
};
