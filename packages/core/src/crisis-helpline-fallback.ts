import type { ChineseCrisisHelplineLocale } from "./crisis-language-locale";
import type { CrisisHelplineLine } from "./crisis-helpline-types";

/**
 * Used only when ThroughLine API credentials are not configured.
 * Prefer THROUGHLINE_CLIENT_ID + THROUGHLINE_CLIENT_SECRET for live data.
 */
const BY_COUNTRY: Record<string, CrisisHelplineLine[]> = {
  hk: [
    {
      name: "Samaritans Hong Kong",
      labelEn: "Samaritans Hong Kong (multi-language)",
      labelZh: "香港撒瑪利亞防止自殺會（多語言）",
      tel: "+85223892222",
      source: "fallback",
    },
    {
      name: "Suicide Prevention Services",
      labelEn: "Suicide Prevention Services HK",
      labelZh: "生命熱線（防止自殺）",
      tel: "+85223820000",
      source: "fallback",
    },
  ],
  us: [
    {
      name: "988 Suicide & Crisis Lifeline",
      labelEn: "988 Suicide & Crisis Lifeline",
      labelZh: "988 自殺與危機熱線（美國）",
      tel: "988",
      source: "fallback",
    },
  ],
  gb: [
    {
      name: "Samaritans UK",
      labelEn: "Samaritans (UK & ROI)",
      labelZh: "Samaritans（英國）",
      tel: "116123",
      source: "fallback",
    },
  ],
  au: [
    {
      name: "Lifeline Australia",
      labelEn: "Lifeline Australia",
      labelZh: "Lifeline 澳洲",
      tel: "131114",
      source: "fallback",
    },
  ],
  th: [
    {
      name: "Samaritans of Thailand",
      labelEn: "Samaritans of Thailand (English)",
      labelZh: "泰國 Samaritans（英語）",
      tel: "+6627136793",
      source: "fallback",
    },
  ],
  jp: [
    {
      name: "TELL Lifeline",
      labelEn: "TELL Lifeline (Japan, English)",
      labelZh: "TELL 生命線（日本，英語）",
      tel: "+81357747632",
      source: "fallback",
    },
  ],
  hu: [
    {
      name: "116 123",
      labelEn: "Hungary emotional support (116 123)",
      labelZh: "匈牙利情緒支援（116 123）",
      tel: "116123",
      source: "fallback",
    },
  ],
  tw: [
    {
      name: "1925",
      labelEn: "Taiwan 1925 — 24h emotional support",
      labelZh: "台灣 1925 安心專線（24 小時）",
      tel: "1925",
      source: "fallback",
    },
    {
      name: "1995",
      labelEn: "Taiwan Lifeline (1995)",
      labelZh: "台灣生命線（1995）",
      tel: "1995",
      source: "fallback",
    },
  ],
  cn: [
    {
      name: "12356",
      labelEn: "China national mental health hotline (12356)",
      labelZh: "全国心理援助热线（12356，中国大陆）",
      tel: "12356",
      source: "fallback",
    },
    {
      name: "Beijing Suicide Research",
      labelEn: "Beijing suicide crisis line (400-161-9995)",
      labelZh: "北京心理危机研究与干预热线（400-161-9995）",
      tel: "4001619995",
      source: "fallback",
    },
  ],
};

export function fallbackSuicideHelplines(
  countryCode: string,
): CrisisHelplineLine[] {
  return BY_COUNTRY[countryCode.toLowerCase()] ?? [];
}

/** Suicide lines when location unknown but chat language implies region. */
export function fallbackSuicideHelplinesForChineseLocale(
  locale: ChineseCrisisHelplineLocale,
): CrisisHelplineLine[] {
  switch (locale) {
    case "cn":
      return fallbackSuicideHelplines("cn");
    case "hk":
      return fallbackSuicideHelplines("hk");
    case "tw":
      return fallbackSuicideHelplines("tw");
    case "hant_multi":
      return [...fallbackSuicideHelplines("hk"), ...fallbackSuicideHelplines("tw")];
    default:
      return [];
  }
}
