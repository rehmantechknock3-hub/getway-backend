/**
 * Format a number as a currency string.
 * @example formatPrice(1999, "USD") // "$19.99"
 */
export function formatPrice(
  cents: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Calculate the platform commission and provider payout from a total amount.
 * @param totalCents  Total amount in cents
 * @param ratePercent Commission rate (default 15%)
 */
export function calculateCommission(
  totalCents: number,
  ratePercent = 15
): { commission: number; providerAmount: number } {
  const commission = Math.round(totalCents * (ratePercent / 100));
  return { commission, providerAmount: totalCents - commission };
}
