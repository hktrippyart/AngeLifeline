import type { EmergencyDisplay } from "@/lib/angelifeline/emergency-routing";

/** Primary unified emergency number by ISO 3166-1 alpha-2 (from public EMS references). */
const EMS_BY_ISO: Record<
  string,
  Pick<EmergencyDisplay, "number" | "subnoteEn" | "subnoteZh">
> = {
  AD: { number: "112" },
  AE: { number: "999", subnoteEn: "Police: 999 · Ambulance: 998" },
  AR: { number: "911" },
  AT: { number: "112" },
  AU: { number: "000" },
  BE: { number: "112" },
  BG: { number: "112" },
  BR: { number: "192", subnoteEn: "Medical: 192 · Fire: 193 · Police: 190" },
  CA: { number: "911" },
  CH: { number: "112", subnoteEn: "Police: 117 · Fire: 118 · Ambulance: 144" },
  CL: { number: "131", subnoteEn: "Ambulance · Police: 133 · Fire: 132" },
  CN: { number: "120", subnoteEn: "Ambulance: 120 · Police: 110 · Fire: 119" },
  CO: { number: "123" },
  CR: { number: "911" },
  CY: { number: "112" },
  CZ: { number: "112" },
  DE: { number: "112" },
  DK: { number: "112" },
  EE: { number: "112" },
  EG: { number: "122", subnoteEn: "Ambulance · Police: 122" },
  ES: { number: "112" },
  FI: { number: "112" },
  FR: { number: "112" },
  GB: { number: "999" },
  GR: { number: "112" },
  HK: { number: "999" },
  HR: { number: "112" },
  HU: { number: "112" },
  ID: { number: "112", subnoteEn: "Also 110 police, 118 ambulance in some areas" },
  IE: { number: "112", subnoteEn: "Also 999" },
  IL: { number: "100", subnoteEn: "Police: 100 · Ambulance: 101 · Fire: 102" },
  IN: { number: "112" },
  IS: { number: "112" },
  IT: { number: "112" },
  JP: { number: "119", subnoteEn: "Police: 110 · Medical/fire: 119" },
  KE: { number: "999" },
  KR: { number: "119", subnoteEn: "Police: 112 · Fire/medical: 119" },
  LT: { number: "112" },
  LU: { number: "112" },
  LV: { number: "112" },
  MA: { number: "19", subnoteEn: "Police · Ambulance: 15 · Fire: 15" },
  MT: { number: "112" },
  MX: { number: "911" },
  MY: { number: "999" },
  NL: { number: "112" },
  NO: { number: "112", subnoteEn: "Police: 112 · Medical: 113 · Fire: 110" },
  NZ: { number: "111" },
  PE: { number: "105", subnoteEn: "Police · Ambulance: 106 · Fire: 116" },
  PH: { number: "911" },
  PL: { number: "112" },
  PT: { number: "112" },
  RO: { number: "112" },
  RS: { number: "112", subnoteEn: "Police: 192 · Fire: 193 · Ambulance: 194" },
  RU: { number: "112" },
  SE: { number: "112" },
  SG: { number: "999", subnoteEn: "Police · Ambulance/fire: 995" },
  SI: { number: "112" },
  SK: { number: "112" },
  TH: { number: "191", subnoteEn: "Ambulance: 1669 · Tourist police: 1155" },
  TR: { number: "112" },
  TW: { number: "119", subnoteEn: "Police: 110 · Fire/medical: 119" },
  UA: { number: "112" },
  US: { number: "911" },
  VN: { number: "113", subnoteEn: "Police: 113 · Fire: 114 · Ambulance: 115" },
  ZA: { number: "112", subnoteEn: "Also 10111 police · 10177 ambulance" },
};

const EU_ISO = new Set([
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

function countryLabel(iso: string, regionHint?: string): string {
  if (regionHint?.trim()) return regionHint.trim();
  return iso;
}

export function emergencyDisplayFromCountryCode(
  iso: string,
  regionHint?: string,
): EmergencyDisplay | undefined {
  const c = iso.trim().toUpperCase();
  const entry = EMS_BY_ISO[c];
  if (!entry) {
    if (EU_ISO.has(c)) {
      return {
        number: "112",
        labelEn: `European emergency (112) — ${countryLabel(c, regionHint)}`,
        labelZh: `歐洲緊急服務 (112) — ${countryLabel(c, regionHint)}`,
        subnoteEn: "Single EU emergency number",
        subnoteZh: "歐盟統一緊急號碼",
      };
    }
    return undefined;
  }
  const place = countryLabel(c, regionHint);
  return {
    number: entry.number,
    labelEn: `Emergency (${entry.number}) — ${place}`,
    labelZh: `緊急服務 (${entry.number}) — ${place}`,
    subnoteEn: entry.subnoteEn,
    subnoteZh: entry.subnoteZh,
  };
}

/** Search/Gemini may return a number when ISO is missing from our table. */
export function emergencyDisplayFromSearch(options: {
  countryCode?: string;
  regionHint?: string;
  emergencyNumber?: string;
}): EmergencyDisplay | undefined {
  if (options.countryCode) {
    const fromIso = emergencyDisplayFromCountryCode(
      options.countryCode,
      options.regionHint,
    );
    if (fromIso) return fromIso;
  }
  const num = options.emergencyNumber?.replace(/\D/g, "");
  if (num && num.length >= 2 && num.length <= 5) {
    const place =
      options.regionHint?.trim() ||
      options.countryCode?.trim() ||
      "your area";
    return {
      number: num,
      labelEn: `Local emergency (${num}) — ${place}`,
      labelZh: `當地緊急服務 (${num}) — ${place}`,
    };
  }
  return undefined;
}

export function helplineSlugFromCountryCode(iso: string | undefined): string | undefined {
  if (!iso?.trim()) return undefined;
  return iso.trim().toLowerCase();
}

/** ISO country from explicit place names in chat — beats wrong first Places hit. */
export function inferCountryCodeFromChat(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (
    lower.includes("taiwan") ||
    lower.includes("tainan") ||
    lower.includes("taipei") ||
    lower.includes("taichung") ||
    lower.includes("kaohsiung") ||
    text.includes("台灣") ||
    text.includes("台湾") ||
    text.includes("臺南") ||
    text.includes("台北") ||
    text.includes("台南")
  ) {
    return "TW";
  }
  return undefined;
}
