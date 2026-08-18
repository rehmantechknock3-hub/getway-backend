import {
  formatNationalNumber,
  isValidNationalNumber,
  isValidStoredPhone,
  phoneDigitsOnly,
  toE164,
  type PhoneCountry,
} from "@repo/schemas";

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

export function isValidRequiredPhone(phone: string): boolean {
  return isValidStoredPhone(phone.trim());
}

export function phoneValidationMessage(country: PhoneCountry, national: string): string {
  const digits = phoneDigitsOnly(national);
  if (!digits) {
    const example = formatNationalNumber(country.example, country.groups);
    const lengthLabel =
      country.min === country.max ? `${country.min} digits` : `${country.min}–${country.max} digits`;
    return `${country.name} numbers are ${lengthLabel}, e.g. ${example}. No leading 0.`;
  }
  if (!isValidNationalNumber(country, digits)) {
    const lengthLabel =
      country.min === country.max ? `${country.min} digits` : `${country.min}–${country.max} digits`;
    return `Enter ${lengthLabel} for ${country.name}.`;
  }
  return `Saved as ${toE164(country, digits)}`;
}
