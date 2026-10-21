import { en, type Locale } from "./en";

const locales: Record<string, Locale> = { en };

export function getLocale(code: string | null | undefined): Locale {
  return locales[code ?? "en"] ?? en;
}
