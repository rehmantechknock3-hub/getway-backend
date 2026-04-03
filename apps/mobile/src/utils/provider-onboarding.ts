/** Normalize stored JSON (legacy `serviceCategory` or new `serviceCategories`). */
export function normalizeProviderServiceCategories(providerOnboarding: unknown): string[] {
  if (!providerOnboarding || typeof providerOnboarding !== "object") return [];
  const o = providerOnboarding as Record<string, unknown>;
  if (Array.isArray(o.serviceCategories)) {
    return o.serviceCategories
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
  }
  if (typeof o.serviceCategory === "string" && o.serviceCategory.trim()) {
    return [o.serviceCategory.trim()];
  }
  return [];
}
