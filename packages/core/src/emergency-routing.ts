import {
  emergencyDisplayFromSearch,
  helplineSlugFromCountryCode,
  inferCountryCodeFromChat,
} from "./country-emergency";
import { LIVE_SEARCH_EVENTS } from "./festival-places";
import type { UiLocale } from "./locale";

/** Inferred from chat place names — not VPN/IP. */
export type EmergencyRegion =
  | "hk"
  | "jp"
  | "th"
  | "uk"
  | "us_ca"
  | "au"
  | "eu"
  | "in";

export type EmergencyDisplay = {
  number: string;
  labelEn: string;
  labelZh: string;
  subnoteEn?: string;
  subnoteZh?: string;
  /** No country/festival inferred — do not show a single wrong EMS digit. */
  locationUnknown?: boolean;
};

const UNKNOWN_LOCATION_EMERGENCY: EmergencyDisplay = {
  number: "",
  labelEn: "Local emergency services",
  labelZh: "當地緊急服務",
  subnoteEn:
    "Tell us your city or country in chat so we can show the right number (112, 999, 911, 119…). If you are in immediate danger, ask someone nearby or dial local emergency services where you are.",
  subnoteZh:
    "請喺對話講你而家嘅國家或城市，我哋先可以顯示啱嘅號碼（112、999、911、119 等）。如有即時危險，請搵身邊人幫手，或喺當地撥打緊急服務。",
  locationUnknown: true,
};

const JP_KEYWORDS = [
  "japan",
  "osaka",
  "tokyo",
  "kyoto",
  "yokohama",
  "nagoya",
  "fukuoka",
  "sapporo",
  "日本",
  "大阪",
  "東京",
  "京都",
];

const UK_KEYWORDS = [
  "united kingdom",
  "britain",
  "england",
  "scotland",
  "wales",
  "london",
  "uk",
];

const US_CA_KEYWORDS = [
  "united states",
  "usa",
  "u.s.",
  "canada",
  "america",
  "new york",
  "california",
  "los angeles",
  "nevada",
  "burning man",
  "black rock city",
];

const AU_KEYWORDS = ["australia", "sydney", "melbourne", "brisbane"];

const TH_KEYWORDS = [
  "thailand",
  "pattaya",
  "bangkok",
  "chiang mai",
  "phuket",
  "泰国",
  "泰國",
];

const HK_KEYWORDS = ["hong kong", "kowloon", "香港", "九龍"];

const IN_KEYWORDS = [
  "india",
  "goa",
  "mumbai",
  "delhi",
  "bangalore",
  "bengaluru",
  "kerala",
  "rajasthan",
  "印度",
];

const EU_KEYWORDS = [
  "hungary",
  "budapest",
  "ozora",
  "germany",
  "berlin",
  "munich",
  "netherlands",
  "amsterdam",
  "belgium",
  "tomorrowland",
  "france",
  "paris",
  "spain",
  "barcelona",
  "ibiza",
  "portugal",
  "lisbon",
  "croatia",
  "boom festival",
  "poland",
  "prague",
  "czech",
  "austria",
  "vienna",
  "italy",
  "greece",
  "europe",
  "eu ",
];

function textHasKeyword(text: string, lower: string, terms: string[]): boolean {
  return terms.some((t) => lower.includes(t.toLowerCase()) || text.includes(t));
}

export function emergencyRegionFromRegionHint(
  regionHint: string | undefined,
): EmergencyRegion | undefined {
  if (!regionHint) return undefined;
  const lower = regionHint.toLowerCase();
  if (lower.includes("hong kong") || regionHint.includes("香港")) return "hk";
  if (
    lower.includes("thailand") ||
    regionHint.includes("泰国") ||
    regionHint.includes("泰國")
  ) {
    return "th";
  }
  if (lower.includes("japan") || regionHint.includes("日本")) return "jp";
  if (
    lower.includes("united kingdom") ||
    lower.includes("england") ||
    lower.includes("scotland") ||
    lower.includes("wales")
  ) {
    return "uk";
  }
  if (lower.includes("australia")) return "au";
  if (
    lower.includes("canada") ||
    lower.includes("united states") ||
    lower.includes("nevada") ||
    lower.includes("u.s.")
  ) {
    return "us_ca";
  }
  if (lower.includes("india") || lower.includes("goa") || regionHint.includes("印度")) {
    return "in";
  }
  if (
    lower.includes("hungary") ||
    lower.includes("germany") ||
    lower.includes("netherlands") ||
    lower.includes("belgium") ||
    lower.includes("france") ||
    lower.includes("spain") ||
    lower.includes("portugal") ||
    lower.includes("croatia") ||
    lower.includes("poland") ||
    lower.includes("czech") ||
    lower.includes("austria") ||
    lower.includes("italy") ||
    lower.includes("greece") ||
    lower.includes("europe")
  ) {
    return "eu";
  }
  return undefined;
}

const EU_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

/** ISO 3166-1 alpha-2 from Google Places address — not from VPN/IP. */
export function emergencyRegionFromCountryCode(
  code: string,
): EmergencyRegion | undefined {
  const c = code.trim().toUpperCase();
  if (c === "US" || c === "CA") return "us_ca";
  if (c === "HK") return "hk";
  if (c === "JP") return "jp";
  if (c === "TH") return "th";
  if (c === "GB" || c === "UK") return "uk";
  if (c === "AU") return "au";
  if (c === "IN") return "in";
  if (EU_COUNTRY_CODES.has(c)) return "eu";
  return undefined;
}

export function inferEmergencyRegion(text: string): EmergencyRegion | undefined {
  const lower = text.toLowerCase();
  const has = (terms: string[]) => textHasKeyword(text, lower, terms);

  if (has(HK_KEYWORDS)) return "hk";
  if (has(TH_KEYWORDS)) return "th";
  if (has(JP_KEYWORDS)) return "jp";
  if (has(IN_KEYWORDS)) return "in";
  if (has(UK_KEYWORDS)) return "uk";
  if (has(AU_KEYWORDS)) return "au";
  if (has(EU_KEYWORDS)) return "eu";
  if (has(US_CA_KEYWORDS)) return "us_ca";
  return undefined;
}

const BY_REGION: Record<EmergencyRegion, EmergencyDisplay> = {
  hk: {
    number: "999",
    labelEn: "Call HK Emergency (999)",
    labelZh: "香港緊急服務 (999)",
  },
  jp: {
    number: "119",
    labelEn: "Japan ambulance / fire (119)",
    labelZh: "日本救急・消防 (119)",
    subnoteEn: "Police: 110 · Medical emergency: 119",
    subnoteZh: "警察：110 · 醫療急救：119",
  },
  th: {
    number: "191",
    labelEn: "Thailand emergency (191)",
    labelZh: "泰國緊急服務 (191)",
    subnoteEn: "Ambulance: 1669 · Tourist police: 1155",
    subnoteZh: "救護車：1669 · 旅遊警察：1155",
  },
  uk: {
    number: "999",
    labelEn: "Call UK Emergency (999)",
    labelZh: "英國緊急服務 (999)",
  },
  us_ca: {
    number: "911",
    labelEn: "Call Emergency (911)",
    labelZh: "緊急服務 (911)",
  },
  au: {
    number: "000",
    labelEn: "Call Australia Emergency (000)",
    labelZh: "澳洲緊急服務 (000)",
  },
  eu: {
    number: "112",
    labelEn: "European emergency (112)",
    labelZh: "歐洲緊急服務 (112)",
    subnoteEn: "Hungary & most of Europe — ambulance, police, fire",
    subnoteZh: "匈牙利及大部分歐洲 — 救護、警察、消防",
  },
  in: {
    number: "112",
    labelEn: "India emergency (112)",
    labelZh: "印度緊急服務 (112)",
    subnoteEn: "Single emergency number — police, fire, ambulance",
    subnoteZh: "全國統一緊急號碼 — 警察、消防、救護",
  },
};

const DEFAULT_HELPLINE_BY_REGION: Record<EmergencyRegion, string> = {
  hk: "hk",
  jp: "jp",
  th: "th",
  uk: "gb",
  us_ca: "us",
  au: "au",
  eu: "hu",
  in: "in",
};

const REGION_HINT_TO_HELPLINE: Record<string, string> = {
  hungary: "hu",
  germany: "de",
  netherlands: "nl",
  belgium: "be",
  france: "fr",
  spain: "es",
  portugal: "pt",
  croatia: "hr",
  poland: "pl",
  czech: "cz",
  austria: "at",
  italy: "it",
  greece: "gr",
  japan: "jp",
  thailand: "th",
  australia: "au",
  "hong kong": "hk",
  india: "in",
  goa: "in",
  taiwan: "tw",
  tainan: "tw",
  taipei: "tw",
};

/** Country slug for https://findahelpline.com/countries/{slug} */
export function inferHelplineCountryCode(options: {
  chatSnippet?: string;
  regionHint?: string;
  emergencyRegion?: EmergencyRegion;
  /** ISO 3166-1 alpha-2 from search / Places — preferred over legacy buckets. */
  countryCode?: string;
}): string | undefined {
  const text = options.chatSnippet ?? "";
  const fromChat = inferCountryCodeFromChat(text);
  if (fromChat) return helplineSlugFromCountryCode(fromChat);

  const fromIso = helplineSlugFromCountryCode(options.countryCode);
  if (fromIso) return fromIso;

  const lower = text.toLowerCase();

  for (const event of LIVE_SEARCH_EVENTS) {
    if (
      event.fallbackHelplineCountry &&
      textHasKeyword(text, lower, event.keywords)
    ) {
      return event.fallbackHelplineCountry;
    }
  }

  if (options.regionHint) {
    const hintLower = options.regionHint.toLowerCase();
    for (const [key, code] of Object.entries(REGION_HINT_TO_HELPLINE)) {
      if (hintLower.includes(key)) return code;
    }
  }

  if (options.emergencyRegion) {
    return DEFAULT_HELPLINE_BY_REGION[options.emergencyRegion];
  }

  return undefined;
}

export function findAHelplineUrl(options: {
  chatSnippet?: string;
  regionHint?: string;
  emergencyRegion?: EmergencyRegion;
  countryCode?: string;
}): string {
  const code = inferHelplineCountryCode(options);
  return code
    ? `https://findahelpline.com/countries/${code}`
    : "https://findahelpline.com";
}

export function resolveEmergencyDisplay(
  _uiLocale: UiLocale,
  options: {
    regionHint?: string;
    emergencyRegion?: EmergencyRegion;
    countryCode?: string;
    emergencyNumber?: string;
    locationKnown: boolean;
    /** Withhold a single EMS digit when region unknown (suicidal ideation without place). */
    withholdEmsWithoutLocation?: boolean;
  },
): EmergencyDisplay {
  if (!options.locationKnown && options.withholdEmsWithoutLocation) {
    return UNKNOWN_LOCATION_EMERGENCY;
  }

  const fromContext = emergencyDisplayFromSearch({
    countryCode: options.countryCode,
    regionHint: options.regionHint,
    emergencyNumber: options.emergencyNumber,
  });
  if (fromContext) return fromContext;

  if (options.emergencyRegion) {
    return BY_REGION[options.emergencyRegion];
  }

  const fromHint = emergencyRegionFromRegionHint(options.regionHint);
  if (fromHint) {
    return BY_REGION[fromHint];
  }

  return UNKNOWN_LOCATION_EMERGENCY;
}
