export const BUSINESS_TIME_ZONE = "America/Bogota";
export const BUSINESS_LOCALE = "es-CO";
export const BUSINESS_CURRENCY = "COP";

const COLOMBIA_UTC_OFFSET = "-05:00";

const dateInputFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  calendar: "iso8601",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function businessDateInputValue(date = new Date()) {
  return dateInputFormatter.format(date);
}

export function businessDateTimeToIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const instant = new Date(`${date}T${time}:00.000${COLOMBIA_UTC_OFFSET}`);

  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

export function businessDateKeyToNoonUtc(date: string) {
  return new Date(`${date}T12:00:00.000Z`);
}
