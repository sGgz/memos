import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import zhHansTranslation from "@/locales/zh-Hans.json";

const LOCALE_STORAGE_KEY = "memos-locale";

const getStoredLocale = (): Locale | null => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "zh-Hans" ? "zh-Hans" : null;
  } catch {
    return null;
  }
};

const setStoredLocale = (locale: Locale): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage might not be available
  }
};

type NestedKeyOf<T, K = keyof T> = K extends keyof T & (string | number)
  ? `${K}` | (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : never)
  : never;

// Represents the keys of nested translation objects.
export type Translations = NestedKeyOf<typeof zhHansTranslation>;

// Represents a typed translation function.
type TypedT = (key: Translations, params?: Record<string, unknown>) => string;

export const useTranslate = (): TypedT => {
  const { t } = useTranslation<Translations>();
  return t;
};

export const isValidateLocale = (locale: string | undefined | null): locale is Locale => locale === "zh-Hans";

// Gets the locale to use with proper priority:
// 1. User setting (if logged in and has preference)
// 2. localStorage (from previous session)
// 3. Browser language preference
export const getLocaleWithFallback = (userLocale?: string): Locale => {
  // Priority 1: User setting (if logged in and valid)
  if (isValidateLocale(userLocale)) {
    return userLocale;
  }

  // Priority 2: localStorage
  const stored = getStoredLocale();
  if (stored) {
    return stored;
  }

  return "zh-Hans";
};

// Applies and persists a locale setting
export const loadLocale = (locale: string): Locale => {
  const validLocale = isValidateLocale(locale) ? locale : "zh-Hans";
  setStoredLocale(validLocale);
  i18n.changeLanguage(validLocale);
  return validLocale;
};

/**
 * Applies locale early during initial page load to prevent language flash.
 * Uses only localStorage and browser language (no user settings yet).
 */
export const applyLocaleEarly = (): void => {
  const stored = getStoredLocale();
  const locale = stored ?? "zh-Hans";
  loadLocale(locale);
};

// Get the display name for a locale in its native language
export const getLocaleDisplayName = (locale: string): string => {
  try {
    const displayName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    if (displayName) {
      return displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
  } catch {
    // Intl.DisplayNames might not be available or might fail for some locales
  }
  return locale;
};
