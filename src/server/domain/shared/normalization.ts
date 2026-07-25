export type TextNormalizationOptions = {
  required?: boolean;
  maxLength?: number;
};

export type NumberNormalizationOptions = {
  min?: number;
  max?: number;
  allowZero?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeText(
  value: unknown,
  { required = false, maxLength }: TextNormalizationOptions = {},
) {
  if (typeof value !== "string") {
    if (required) {
      throw new Error("Expected text value.");
    }

    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    if (required) {
      throw new Error("Text value is required.");
    }

    return null;
  }

  if (maxLength !== undefined && normalized.length > maxLength) {
    throw new Error(`Text value must be at most ${maxLength} characters.`);
  }

  return normalized;
}

export function normalizeEmail(value: unknown) {
  const normalized = normalizeText(value)?.toLowerCase() ?? null;

  if (normalized && !EMAIL_PATTERN.test(normalized)) {
    throw new Error("Email must be valid.");
  }

  return normalized;
}

export function normalizeDocument(value: unknown) {
  const normalized =
    normalizeText(value)
      ?.replace(/[^a-z0-9]/gi, "")
      .toUpperCase() ?? null;

  return normalized || null;
}

export function normalizePhone(value: unknown) {
  const normalized = normalizeText(value)?.replace(/[^0-9+]/g, "") ?? null;

  return normalized || null;
}

export function normalizeMoney(
  value: unknown,
  { min = 0, allowZero = false }: NumberNormalizationOptions = {},
) {
  const numericValue =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
    throw new Error("Money value must be numeric.");
  }

  if (numericValue < min || (!allowZero && numericValue === 0)) {
    throw new Error("Money value must be positive.");
  }

  return numericValue.toFixed(2);
}

export function normalizeInteger(
  value: unknown,
  { min, max }: NumberNormalizationOptions = {},
) {
  const numericValue =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (
    typeof numericValue !== "number" ||
    !Number.isFinite(numericValue) ||
    !Number.isInteger(numericValue)
  ) {
    throw new Error("Integer value is required.");
  }

  if (min !== undefined && numericValue < min) {
    throw new Error(`Integer value must be at least ${min}.`);
  }

  if (max !== undefined && numericValue > max) {
    throw new Error(`Integer value must be at most ${max}.`);
  }

  return numericValue;
}
