import { emergencyDisplayFromCountryCode } from "./country-emergency";
import { isSuicidalCrisis } from "./crisis-focus";
import type { EmergencyDisplay } from "./emergency-routing";
import type { UiLocale } from "./locale";
import { textContainsSimplifiedChinese } from "./simplified-chinese";

/** Find a Helpline / ThroughLine country slug when GPS is unknown. */
export type ChineseCrisisHelplineLocale = "cn" | "hk" | "tw" | "hant_multi";

const HK_HINTS = [
  "hong kong",
  "kowloon",
  "香港",
  "九龍",
  "港島",
  "中環",
  "廣東話",
  "粵語",
];

const TW_HINTS = [
  "taiwan",
  "taipei",
  "taichung",
  "kaohsiung",
  "台灣",
  "臺灣",
  "台北",
  "臺北",
  "高雄",
  "台中",
  "新北",
];

const CANTONESE_MARKERS = [
  "唔",
  "喺",
  "哋",
  "嘅",
  "冇",
  "搵",
  "俾",
  "啱",
  "呢度",
  "點解",
  "乜",
  "嚟",
  "佢",
  "嗰",
  "喎",
  "咋",
  "囉",
  "喘唔到",
];

function hasHint(text: string, lower: string, hints: string[]): boolean {
  return hints.some((h) => lower.includes(h) || text.includes(h));
}

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * When suicide crisis has no place, infer which Chinese crisis lines to show.
 * Simplified → mainland China; Traditional → HK + Taiwan (or one if disambiguated).
 */
export function inferChineseCrisisHelplineLocale(
  chatSnippet: string,
  uiLocale?: UiLocale,
): ChineseCrisisHelplineLocale | undefined {
  const text = chatSnippet.trim();
  if (!text) return undefined;
  if (!isSuicidalCrisis(text) && uiLocale !== "zh-Hant") {
    return undefined;
  }

  const lower = text.toLowerCase();

  if (textContainsSimplifiedChinese(text)) {
    return "cn";
  }

  if (!hasCjk(text) && uiLocale !== "zh-Hant") {
    return undefined;
  }

  if (hasHint(text, lower, TW_HINTS)) {
    return "tw";
  }
  if (hasHint(text, lower, HK_HINTS)) {
    return "hk";
  }
  if (CANTONESE_MARKERS.some((m) => text.includes(m))) {
    return "hk";
  }

  return "hant_multi";
}

/** Primary EMS (999, 119, …) paired with language-inferred suicide helplines. */
export function primaryEmergencyDisplaysForChineseLocale(
  locale: ChineseCrisisHelplineLocale,
): EmergencyDisplay[] {
  const pick = (iso: string, place: string): EmergencyDisplay | undefined =>
    emergencyDisplayFromCountryCode(iso, place);

  switch (locale) {
    case "hk": {
      const d = pick("HK", "Hong Kong");
      return d ? [d] : [];
    }
    case "tw": {
      const d = pick("TW", "Taiwan");
      return d ? [d] : [];
    }
    case "cn": {
      const d = pick("CN", "China");
      return d ? [d] : [];
    }
    case "hant_multi":
      return [
        pick("HK", "Hong Kong"),
        pick("TW", "Taiwan"),
      ].filter((d): d is EmergencyDisplay => Boolean(d));
    default:
      return [];
  }
}
