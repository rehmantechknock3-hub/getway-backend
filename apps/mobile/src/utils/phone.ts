/** Keep only an optional leading + and digits (E.164-style). */
export function sanitizePhoneInput(raw: string): string {
  let result = "";
  for (const char of raw) {
    if (char >= "0" && char <= "9") {
      result += char;
      continue;
    }
    if (char === "+" && result.length === 0) {
      result = "+";
    }
  }
  return result;
}

export function countPhoneDigits(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

export function isValidRequiredPhone(phone: string): boolean {
  const trimmed = phone.trim();
  return /^\+?\d+$/.test(trimmed) && countPhoneDigits(trimmed) >= 6;
}
