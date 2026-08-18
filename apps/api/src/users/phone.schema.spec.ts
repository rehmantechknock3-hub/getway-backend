import { describe, expect, it } from "vitest";

import {
  PhoneNumberSchema,
  getDefaultPhoneCountry,
  isValidStoredPhone,
  splitE164,
  toE164,
} from "@repo/schemas";

describe("phone countries", () => {
  it("defaults to Cyprus and formats a valid mobile as E.164", () => {
    const cyprus = getDefaultPhoneCountry();
    expect(cyprus.iso).toBe("CY");
    expect(cyprus.dial).toBe("357");
    expect(toE164(cyprus, "99123456")).toBe("+35799123456");
    expect(PhoneNumberSchema.safeParse("+35799123456").success).toBe(true);
  });

  it("rejects a Cyprus number that is too short", () => {
    expect(isValidStoredPhone("+35799123")).toBe(false);
    expect(PhoneNumberSchema.safeParse("+35799123").success).toBe(false);
    expect(PhoneNumberSchema.safeParse("99123456").success).toBe(false);
  });

  it("splits a stored Cyprus number back into country + national", () => {
    expect(splitE164("+35799123456")).toEqual({
      country: expect.objectContaining({ iso: "CY", dial: "357" }),
      national: "99123456",
    });
  });
});
