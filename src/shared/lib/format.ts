/**
 * Formatting utilities used across the app. Keep formatters here so locale
 * and currency conventions are consistent across every screen.
 */

import {
  BUSINESS_CURRENCY,
  BUSINESS_LOCALE,
  BUSINESS_TIME_ZONE,
  businessDateKeyToNoonUtc,
} from "./businessLocale";

export const currency = (value: number, currencyCode = BUSINESS_CURRENCY) =>
  new Intl.NumberFormat(BUSINESS_LOCALE, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);

export const compactNumber = (value: number) =>
  new Intl.NumberFormat(BUSINESS_LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const time = (date: Date) =>
  new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

export const longDate = (date: Date | string) =>
  new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(typeof date === "string" ? businessDateKeyToNoonUtc(date) : date);

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
