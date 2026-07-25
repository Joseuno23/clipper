export type ShopLocalDate = {
  year: number;
  month: number;
  day: number;
};

export type ShopDayBoundaries = {
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
};

type LocalDateTimeParts = ShopLocalDate & {
  hour: number;
  minute: number;
  second: number;
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cached = dateTimeFormatters.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // Force Intl to validate the timezone before caching it.
  formatter.format(new Date(0));
  dateTimeFormatters.set(timeZone, formatter);

  return formatter;
}

export function assertValidShopTimeZone(timeZone: string) {
  if (typeof timeZone !== "string" || timeZone.trim() === "") {
    throw new Error("Shop timezone is required.");
  }

  try {
    getFormatter(timeZone);
  } catch {
    throw new Error(`Invalid shop timezone: ${timeZone}`);
  }

  return timeZone;
}

function getLocalDateTimeParts(
  timeZone: string,
  instant: Date,
): LocalDateTimeParts {
  assertValidShopTimeZone(timeZone);

  const parts = getFormatter(timeZone).formatToParts(instant);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(byType.get("year")),
    month: Number(byType.get("month")),
    day: Number(byType.get("day")),
    hour: Number(byType.get("hour")),
    minute: Number(byType.get("minute")),
    second: Number(byType.get("second")),
  };
}

function formatDateKey(date: ShopLocalDate) {
  return [date.year, date.month, date.day]
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, "0"),
    )
    .join("-");
}

function getTimeZoneOffsetMs(timeZone: string, instant: Date) {
  const parts = getLocalDateTimeParts(timeZone, instant);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localAsUtc - instant.getTime();
}

function localDateTimeToUtc(timeZone: string, local: LocalDateTimeParts) {
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const firstPass = new Date(
    localAsUtc - getTimeZoneOffsetMs(timeZone, new Date(localAsUtc)),
  );
  const secondPass = new Date(
    localAsUtc - getTimeZoneOffsetMs(timeZone, firstPass),
  );

  return secondPass;
}

function addLocalDays(date: ShopLocalDate, days: number): ShopLocalDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function getShopLocalDate(
  timeZone: string,
  instant = new Date(),
): ShopLocalDate {
  const { year, month, day } = getLocalDateTimeParts(timeZone, instant);

  return { year, month, day };
}

export function getShopLocalDateKey(timeZone: string, instant = new Date()) {
  return formatDateKey(getShopLocalDate(timeZone, instant));
}

export function getShopLocalDayBoundaries(
  timeZone: string,
  instant = new Date(),
): ShopDayBoundaries {
  const date = getShopLocalDate(timeZone, instant);
  const nextDate = addLocalDays(date, 1);

  return {
    dateKey: formatDateKey(date),
    startsAt: localDateTimeToUtc(timeZone, {
      ...date,
      hour: 0,
      minute: 0,
      second: 0,
    }),
    endsAt: localDateTimeToUtc(timeZone, {
      ...nextDate,
      hour: 0,
      minute: 0,
      second: 0,
    }),
  };
}

export function areSameShopLocalDay(timeZone: string, left: Date, right: Date) {
  return (
    getShopLocalDateKey(timeZone, left) === getShopLocalDateKey(timeZone, right)
  );
}
