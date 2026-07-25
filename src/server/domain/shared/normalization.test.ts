// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  normalizeDocument,
  normalizeEmail,
  normalizeInteger,
  normalizeMoney,
  normalizePhone,
  normalizeText,
} from "./normalization";

describe("shared normalization helpers", () => {
  it("trims and collapses text", () => {
    expect(normalizeText("  Ana   María  ")).toBe("Ana María");
    expect(normalizeText("   ")).toBeNull();
  });

  it("normalizes email, document, and phone values", () => {
    expect(normalizeEmail(" ADMIN@CLIPPER.TEST ")).toBe("admin@clipper.test");
    expect(normalizeDocument(" 20-123.456 ")).toBe("20123456");
    expect(normalizePhone(" +54 11 5555-7777 ")).toBe("+541155557777");
  });

  it("normalizes numeric values", () => {
    expect(normalizeMoney("12.5")).toBe("12.50");
    expect(normalizeInteger("10", { min: 1, max: 20 })).toBe(10);
  });
});
