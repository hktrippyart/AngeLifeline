import { EMS_FROM_ISO } from "./angelifeline-ems-iso";
import type { EmergencyDisplay } from "./emergency-routing";

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
  const info = EMS_FROM_ISO[iso];
  return info?.label.en ?? iso;
}

function primaryNumber(iso: string): string | undefined {
  const info = EMS_FROM_ISO[iso];
  return info?.numbers[0]?.tel;
}

function subnoteFromNumbers(iso: string): { subnoteEn?: string; subnoteZh?: string } {
  const info = EMS_FROM_ISO[iso];
  if (!info || info.numbers.length <= 1) return {};
  const partsEn = info.numbers.map((n) => `${n.en}: ${n.tel}`);
  const partsZh = info.numbers.map((n) => `${n.zh}：${n.tel}`);
  return {
    subnoteEn: partsEn.join(" · "),
    subnoteZh: partsZh.join(" · "),
  };
}

export function emergencyDisplayFromCountryCode(
  iso: string,
  regionHint?: string,
): EmergencyDisplay | undefined {
  const c = iso.trim().toUpperCase();
  const num = primaryNumber(c);
  if (!num) {
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
  const sub = subnoteFromNumbers(c);
  return {
    number: num,
    labelEn: `Emergency (${num}) — ${place}`,
    labelZh: `緊急服務 (${num}) — ${place}`,
    ...sub,
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
