export const PYG_LOCALE = 'es-PY';
export const CURRENCY_SUFFIX = ' Gs.';
const MAX_DECIMALS = 2;

type NormalizeOptions = {
  enforceDecimals?: boolean;
  decimals?: number;
};

const stripLeadingZeros = (value: string): string => value.replace(/^0+(?=\d)/, '');

const normalizeIntegerDigits = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }
  const stripped = stripLeadingZeros(digitsOnly);
  return stripped === '' ? '0' : stripped;
};

const normalizeFractionDigits = (value: string, decimals: number = MAX_DECIMALS): string =>
  value.replace(/\D/g, '').slice(0, decimals);
export const normalizeCurrencyRawValue = (rawValue: string, options: NormalizeOptions = {}): string => {
  if (!rawValue) {
    return '';
  }

  const sanitized = rawValue.replace(/[^\d.]/g, '');
  if (!sanitized) {
    return '';
  }

  const [integerPartRaw, fractionPartRaw = ''] = sanitized.split('.', 2);
  const integerDigits = normalizeIntegerDigits(integerPartRaw);
  const fractionDigits = normalizeFractionDigits(
    fractionPartRaw,
    options.decimals ?? MAX_DECIMALS
  );

  if (!integerDigits && !fractionDigits) {
    return '';
  }

  if (!integerDigits) {
    return fractionDigits ? `0.${fractionDigits}` : '';
  }

  if (options.enforceDecimals) {
    const decimals = options.decimals ?? MAX_DECIMALS;
    const paddedFraction = (fractionDigits + '0'.repeat(decimals)).slice(0, decimals);
    return `${integerDigits}.${paddedFraction}`;
  }

  return fractionDigits ? `${integerDigits}.${fractionDigits}` : integerDigits;
};
export const parseCurrencyInput = (input: string): string => {
  if (!input) {
    return '';
  }

  const cleaned = input.replace(/[^0-9.,]/g, '');
  if (!cleaned) {
    return '';
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  let integerPart = cleaned;
  let fractionPart = '';

  if (decimalIndex !== -1) {
    integerPart = cleaned.slice(0, decimalIndex);
    fractionPart = cleaned.slice(decimalIndex + 1);
  }

  const integerDigits = integerPart.replace(/\D/g, '');
  const fractionDigits = fractionPart.replace(/\D/g, '');
  const composed = fractionDigits ? `${integerDigits}.${fractionDigits}` : integerDigits;

  return normalizeCurrencyRawValue(composed);
};
export const formatCurrencyInput = (rawValue: string): string => {
  const normalized = normalizeCurrencyRawValue(rawValue);

  if (!normalized) {
    return '';
  }

  const [integerPart, fractionPart = ''] = normalized.split('.', 2);
  const integerNumber = Number.parseInt(integerPart, 10);

  if (!Number.isFinite(integerNumber)) {
    return '';
  }

  const formattedInteger = integerNumber.toLocaleString(PYG_LOCALE);
  const formattedValue = fractionPart ? `${formattedInteger},${fractionPart}` : formattedInteger;

  return `${formattedValue}${CURRENCY_SUFFIX}`;
};
export interface FormatCurrencyDisplayOptions {
  decimals?: number;
  showSuffix?: boolean;
  enforceDecimals?: boolean;
}

export const formatCurrencyDisplay = (
  value: number,
  options: FormatCurrencyDisplayOptions = {}
): string => {
  if (!Number.isFinite(value)) {
    const fallback = options.enforceDecimals ? '0.00' : '0';
    return options.showSuffix === false ? fallback : `${fallback}${CURRENCY_SUFFIX}`;
  }

  const decimalsFromOptions = options.enforceDecimals
    ? options.decimals ?? MAX_DECIMALS
    : options.decimals;

  const decimals = typeof decimalsFromOptions === 'number'
    ? Math.max(0, decimalsFromOptions)
    : Number.isInteger(value)
    ? 0
    : MAX_DECIMALS;

  const formatted = value.toLocaleString(PYG_LOCALE, {
    minimumFractionDigits: options.enforceDecimals ? decimals : 0,
    maximumFractionDigits: decimals,
  });

  return options.showSuffix === false ? formatted : `${formatted}${CURRENCY_SUFFIX}`;
};
export const rawValueToNumber = (rawValue: string): number => {
  const normalized = normalizeCurrencyRawValue(rawValue);
  if (!normalized) {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
