/** UI languages supported by AngeLifeline overlay and crisis copy. */
export type UiLocale = "en" | "zh-Hant";

export function isUiLocale(value: string | undefined): value is UiLocale {
  return value === "en" || value === "zh-Hant";
}
