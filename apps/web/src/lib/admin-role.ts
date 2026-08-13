type SessionClaimsLike = {
  metadata?: { role?: string };
  publicMetadata?: { role?: string };
  public_metadata?: { role?: string };
};

/** Read role from Clerk session claims (Sessions → customize token with `metadata`). */
export function roleFromSessionClaims(sessionClaims: unknown): string | undefined {
  const claims = sessionClaims as SessionClaimsLike | null | undefined;
  return (
    claims?.metadata?.role ??
    claims?.publicMetadata?.role ??
    claims?.public_metadata?.role
  );
}

export function isAdminRole(role: string | undefined): role is "ADMIN" {
  return role === "ADMIN";
}
