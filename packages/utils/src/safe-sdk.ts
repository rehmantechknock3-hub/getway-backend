/**
 * Safe wrappers for third-party SDKs with unreliable error contracts.
 *
 * Some SDKs (Clerk, Stripe) declare TypeScript return types like `{ error }` but
 * internally throw raw `Error` when preconditions aren't met. These wrappers
 * guarantee a normalized return — never an uncaught throw.
 *
 * @see BEST_PRACTICES.md §12
 */

/**
 * Wraps a Clerk-style SDK call that claims to return `{ error }` but may throw.
 *
 * Guarantees: always returns the full SDK result shape — never throws.
 * On success, returns the original result (including all non-error fields like
 * `createdSessionId`, `status`, etc.). On thrown error, returns `{ error }`.
 *
 * @example
 * const result = await safeClerkCall(() =>
 *   signIn.password({ identifier: email, password }),
 * );
 * if (result.error) {
 *   showToast('error', result.error.message ?? 'Sign in failed');
 *   return;
 * }
 */
export async function safeClerkCall<R extends { error: unknown }>(
  fn: () => Promise<R>,
): Promise<R | { error: Error }> {
  try {
    return await fn();
  } catch (thrown: unknown) {
    return {
      error: thrown instanceof Error ? thrown : new Error(String(thrown)),
    };
  }
}
