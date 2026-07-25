// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  areSameShopLocalDay,
  assertValidShopTimeZone,
  getShopLocalDate,
  getShopLocalDateKey,
  getShopLocalDayBoundaries,
} from ".";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";
const NEW_YORK = "America/New_York";

describe("shop timezone helpers", () => {
  it("formats the shop local date from an explicit timezone", () => {
    const instant = new Date("2026-07-25T02:30:00.000Z");

    expect(getShopLocalDate(BUENOS_AIRES, instant)).toEqual({
      year: 2026,
      month: 7,
      day: 24,
    });
    expect(getShopLocalDateKey(BUENOS_AIRES, instant)).toBe("2026-07-24");
  });

  it("separates same UTC date instants when they fall on different shop local days", () => {
    const latePreviousShopDay = new Date("2026-07-25T02:30:00.000Z");
    const startOfNextShopDay = new Date("2026-07-25T03:30:00.000Z");

    expect(
      areSameShopLocalDay(
        BUENOS_AIRES,
        latePreviousShopDay,
        startOfNextShopDay,
      ),
    ).toBe(false);
  });

  it("keeps future instants together when they share the same named timezone day", () => {
    const morning = new Date("2026-11-15T14:00:00.000Z");
    const evening = new Date("2026-11-16T04:30:00.000Z");

    expect(getShopLocalDateKey(NEW_YORK, morning)).toBe("2026-11-15");
    expect(getShopLocalDateKey(NEW_YORK, evening)).toBe("2026-11-15");
    expect(areSameShopLocalDay(NEW_YORK, morning, evening)).toBe(true);
  });

  it("returns UTC boundaries for the current shop local day", () => {
    const instant = new Date("2026-07-25T02:30:00.000Z");

    expect(getShopLocalDayBoundaries(BUENOS_AIRES, instant)).toEqual({
      dateKey: "2026-07-24",
      startsAt: new Date("2026-07-24T03:00:00.000Z"),
      endsAt: new Date("2026-07-25T03:00:00.000Z"),
    });
  });

  it("rejects invalid shop timezones", () => {
    expect(() => assertValidShopTimeZone("Not/AZone")).toThrow(
      "Invalid shop timezone: Not/AZone",
    );
  });
});
