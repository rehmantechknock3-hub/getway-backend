/** iso, name, dial, min NSN, max NSN, example (national digits), grouping */
const RAW: Array<[string, string, string, number, number, string, number[]]> = [
  ["CY", "Cyprus", "357", 8, 8, "99123456", [2, 6]],
  ["AL", "Albania", "355", 9, 9, "691234567", [3, 3, 3]],
  ["DZ", "Algeria", "213", 8, 9, "551234567", [3, 2, 2, 2]],
  ["AD", "Andorra", "376", 6, 9, "312345", [3, 3]],
  ["AR", "Argentina", "54", 10, 11, "91123456789", [2, 4, 4]],
  ["AM", "Armenia", "374", 8, 8, "77123456", [2, 6]],
  ["AU", "Australia", "61", 9, 9, "412345678", [3, 3, 3]],
  ["AT", "Austria", "43", 10, 13, "6641234567", [3, 7]],
  ["AZ", "Azerbaijan", "994", 9, 9, "501234567", [2, 3, 4]],
  ["BH", "Bahrain", "973", 8, 8, "36001234", [4, 4]],
  ["BD", "Bangladesh", "880", 10, 10, "1712345678", [3, 7]],
  ["BY", "Belarus", "375", 9, 9, "291234567", [2, 3, 4]],
  ["BE", "Belgium", "32", 8, 9, "470123456", [3, 2, 2, 2]],
  ["BA", "Bosnia and Herzegovina", "387", 8, 8, "61123456", [2, 6]],
  ["BR", "Brazil", "55", 10, 11, "11987654321", [2, 5, 4]],
  ["BG", "Bulgaria", "359", 8, 9, "871234567", [3, 3, 3]],
  ["CA", "Canada", "1", 10, 10, "4165551234", [3, 3, 4]],
  ["CL", "Chile", "56", 9, 9, "912345678", [1, 4, 4]],
  ["CN", "China", "86", 11, 11, "13123456789", [3, 4, 4]],
  ["CO", "Colombia", "57", 10, 10, "3211234567", [3, 3, 4]],
  ["HR", "Croatia", "385", 8, 9, "912345678", [2, 3, 4]],
  ["CZ", "Czechia", "420", 9, 9, "601123456", [3, 3, 3]],
  ["DK", "Denmark", "45", 8, 8, "20123456", [2, 2, 2, 2]],
  ["EG", "Egypt", "20", 10, 10, "1001234567", [3, 3, 4]],
  ["EE", "Estonia", "372", 7, 8, "51234567", [2, 6]],
  ["FI", "Finland", "358", 9, 10, "401234567", [2, 3, 4]],
  ["FR", "France", "33", 9, 9, "612345678", [1, 2, 2, 2, 2]],
  ["GE", "Georgia", "995", 9, 9, "555123456", [3, 2, 2, 2]],
  ["DE", "Germany", "49", 10, 11, "15123456789", [3, 8]],
  ["GH", "Ghana", "233", 9, 9, "241234567", [2, 3, 4]],
  ["GR", "Greece", "30", 10, 10, "6912345678", [3, 7]],
  ["HK", "Hong Kong", "852", 8, 8, "51234567", [4, 4]],
  ["HU", "Hungary", "36", 8, 9, "201234567", [2, 3, 4]],
  ["IS", "Iceland", "354", 7, 7, "6111234", [3, 4]],
  ["IN", "India", "91", 10, 10, "9876543210", [5, 5]],
  ["ID", "Indonesia", "62", 9, 12, "81234567890", [3, 4, 4]],
  ["IQ", "Iraq", "964", 10, 10, "7901234567", [3, 3, 4]],
  ["IE", "Ireland", "353", 9, 9, "850123456", [2, 3, 4]],
  ["IL", "Israel", "972", 8, 9, "501234567", [2, 3, 4]],
  ["IT", "Italy", "39", 9, 10, "3123456789", [3, 3, 4]],
  ["JP", "Japan", "81", 10, 10, "9012345678", [2, 4, 4]],
  ["JO", "Jordan", "962", 8, 9, "790123456", [2, 3, 4]],
  ["KZ", "Kazakhstan", "7", 10, 10, "7011234567", [3, 3, 4]],
  ["KE", "Kenya", "254", 9, 9, "712123456", [3, 6]],
  ["KW", "Kuwait", "965", 8, 8, "50012345", [4, 4]],
  ["LV", "Latvia", "371", 8, 8, "21234567", [2, 3, 3]],
  ["LB", "Lebanon", "961", 7, 8, "71123456", [2, 3, 3]],
  ["LY", "Libya", "218", 9, 9, "912345678", [2, 3, 4]],
  ["LI", "Liechtenstein", "423", 7, 9, "6601234", [3, 4]],
  ["LT", "Lithuania", "370", 8, 8, "61234567", [3, 5]],
  ["LU", "Luxembourg", "352", 9, 9, "621123456", [3, 3, 3]],
  ["MY", "Malaysia", "60", 9, 10, "123456789", [2, 3, 4]],
  ["MT", "Malta", "356", 8, 8, "99123456", [4, 4]],
  ["MX", "Mexico", "52", 10, 10, "5512345678", [2, 4, 4]],
  ["MD", "Moldova", "373", 8, 8, "62123456", [3, 5]],
  ["ME", "Montenegro", "382", 8, 8, "67123456", [2, 6]],
  ["MA", "Morocco", "212", 9, 9, "612345678", [3, 2, 2, 2]],
  ["NL", "Netherlands", "31", 9, 9, "612345678", [1, 4, 4]],
  ["NZ", "New Zealand", "64", 8, 10, "211234567", [2, 3, 4]],
  ["NG", "Nigeria", "234", 10, 10, "8021234567", [3, 3, 4]],
  ["MK", "North Macedonia", "389", 8, 8, "70123456", [2, 6]],
  ["NO", "Norway", "47", 8, 8, "40612345", [3, 2, 3]],
  ["OM", "Oman", "968", 8, 8, "92123456", [4, 4]],
  ["PK", "Pakistan", "92", 10, 10, "3001234567", [3, 7]],
  ["PS", "Palestine", "970", 9, 9, "599123456", [3, 3, 3]],
  ["PH", "Philippines", "63", 10, 10, "9171234567", [3, 3, 4]],
  ["PL", "Poland", "48", 9, 9, "512345678", [3, 3, 3]],
  ["PT", "Portugal", "351", 9, 9, "912345678", [3, 3, 3]],
  ["QA", "Qatar", "974", 8, 8, "33123456", [4, 4]],
  ["RO", "Romania", "40", 9, 9, "712345678", [3, 3, 3]],
  ["RU", "Russia", "7", 10, 10, "9121234567", [3, 3, 4]],
  ["SA", "Saudi Arabia", "966", 9, 9, "512345678", [2, 3, 4]],
  ["RS", "Serbia", "381", 8, 9, "601234567", [2, 3, 4]],
  ["SG", "Singapore", "65", 8, 8, "81234567", [4, 4]],
  ["SK", "Slovakia", "421", 9, 9, "901123456", [3, 3, 3]],
  ["SI", "Slovenia", "386", 8, 8, "31123456", [2, 3, 3]],
  ["ZA", "South Africa", "27", 9, 9, "821234567", [2, 3, 4]],
  ["KR", "South Korea", "82", 9, 10, "1012345678", [2, 4, 4]],
  ["ES", "Spain", "34", 9, 9, "612345678", [3, 3, 3]],
  ["LK", "Sri Lanka", "94", 9, 9, "712345678", [2, 3, 4]],
  ["SE", "Sweden", "46", 9, 9, "701234567", [2, 3, 4]],
  ["CH", "Switzerland", "41", 9, 9, "781234567", [2, 3, 4]],
  ["SY", "Syria", "963", 9, 9, "944123456", [3, 3, 3]],
  ["TW", "Taiwan", "886", 9, 9, "912345678", [3, 3, 3]],
  ["TH", "Thailand", "66", 9, 9, "812345678", [2, 3, 4]],
  ["TN", "Tunisia", "216", 8, 8, "20123456", [2, 3, 3]],
  ["TR", "Turkey", "90", 10, 10, "5321234567", [3, 3, 4]],
  ["UA", "Ukraine", "380", 9, 9, "501234567", [2, 3, 4]],
  ["AE", "United Arab Emirates", "971", 9, 9, "501234567", [2, 3, 4]],
  ["GB", "United Kingdom", "44", 10, 10, "7400123456", [4, 6]],
  ["US", "United States", "1", 10, 10, "2025551234", [3, 3, 4]],
  ["VN", "Vietnam", "84", 9, 10, "912345678", [3, 3, 3]],
];

export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
  min: number;
  max: number;
  example: string;
  groups: number[];
};

export const DEFAULT_PHONE_COUNTRY_ISO = "CY";

export const PHONE_COUNTRIES: PhoneCountry[] = RAW.map(
  ([iso, name, dial, min, max, example, groups]) => ({
    iso,
    name,
    dial,
    min,
    max,
    example,
    groups,
  })
);

const BY_ISO = new Map(PHONE_COUNTRIES.map((country) => [country.iso, country]));

/** Longer dial codes first so +1242 is not swallowed by +1 if we add NANP splits later. */
const BY_DIAL_DESC = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

const E164_SHAPE = /^\+[1-9]\d{6,14}$/;

export function getPhoneCountry(iso: string): PhoneCountry | undefined {
  return BY_ISO.get(iso.toUpperCase());
}

export function getDefaultPhoneCountry(): PhoneCountry {
  const country = BY_ISO.get(DEFAULT_PHONE_COUNTRY_ISO);
  if (!country) throw new Error("Default phone country CY is missing");
  return country;
}

export function phoneDigitsOnly(raw: string): string {
  let out = "";
  for (const char of raw) {
    if (char >= "0" && char <= "9") out += char;
  }
  return out;
}

export function formatNationalNumber(digits: string, groups: number[]): string {
  if (groups.length === 0) return digits;
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  if (index < digits.length) parts.push(digits.slice(index));
  return parts.filter((part) => part.length > 0).join(" ");
}

export function toE164(country: PhoneCountry, nationalDigits: string): string {
  return `+${country.dial}${phoneDigitsOnly(nationalDigits)}`;
}

const SHARED_DIAL_PREFERRED: Record<string, string> = {
  "1": "US",
  "7": "RU",
};

/**
 * ponytail: shared dial codes (+1, +7) map to US / RU when national length is valid.
 * Split by area code if we need country-accurate NANP or Kazakhstan.
 */
export function matchPhoneCountry(e164OrDigits: string): PhoneCountry | undefined {
  const digits = phoneDigitsOnly(e164OrDigits);
  const exact: PhoneCountry[] = [];
  for (const country of BY_DIAL_DESC) {
    if (!digits.startsWith(country.dial)) continue;
    const national = digits.slice(country.dial.length);
    if (national.length >= country.min && national.length <= country.max) exact.push(country);
  }
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const first = exact[0];
    if (!first) return undefined;
    const preferredIso = SHARED_DIAL_PREFERRED[first.dial];
    return exact.find((country) => country.iso === preferredIso) ?? first;
  }
  for (const country of BY_DIAL_DESC) {
    if (digits.startsWith(country.dial)) return country;
  }
  return undefined;
}

export function splitE164(
  value: string
): { country: PhoneCountry; national: string } | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return undefined;
  const country = matchPhoneCountry(trimmed);
  if (!country) return undefined;
  return {
    country,
    national: phoneDigitsOnly(trimmed).slice(country.dial.length),
  };
}

export function normalizeNationalDigits(country: PhoneCountry, raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const parsed = splitE164(trimmed);
    if (parsed) return parsed.national.slice(0, country.max);
  }

  let digits = phoneDigitsOnly(raw);
  if (digits.startsWith(country.dial) && digits.length > country.dial.length) {
    digits = digits.slice(country.dial.length);
  }
  if (digits.startsWith("0")) {
    const stripped = digits.replace(/^0+/, "");
    if (stripped.length >= country.min && stripped.length <= country.max) {
      digits = stripped;
    }
  }
  return digits.slice(0, country.max);
}

export function isValidNationalNumber(country: PhoneCountry, national: string): boolean {
  const digits = phoneDigitsOnly(national);
  return digits.length >= country.min && digits.length <= country.max;
}

export function isValidStoredPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!E164_SHAPE.test(trimmed)) return false;
  const parsed = splitE164(trimmed);
  if (!parsed) return true;
  return isValidNationalNumber(parsed.country, parsed.national);
}

export function splitPhoneInput(
  value: string,
  fallbackIso = DEFAULT_PHONE_COUNTRY_ISO
): { country: PhoneCountry; national: string } {
  const parsed = splitE164(value);
  if (parsed) return parsed;
  const fallback = getPhoneCountry(fallbackIso) ?? getDefaultPhoneCountry();
  return { country: fallback, national: phoneDigitsOnly(value) };
}
