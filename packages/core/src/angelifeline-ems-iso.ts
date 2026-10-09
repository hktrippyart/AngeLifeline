import type { EmsNumber, RegionInfo } from "./angelifeline-pipeline-types";
import wikiEntries from "./data/emergency-numbers-wiki.json";

type WikiEntry = (typeof wikiEntries)[number];

function cleanDigits(all: unknown): string[] {
  if (!Array.isArray(all)) return [];
  const out: string[] = [];
  for (const x of all) {
    if (typeof x !== "string") continue;
    const tel = x.replace(/\D/g, "");
    if (tel.length >= 2 && tel.length <= 5) out.push(tel);
  }
  return out;
}

function uniqueTels(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const t of list) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

function wikiToNumbers(entry: WikiEntry): EmsNumber[] {
  const police = cleanDigits(entry.Police?.All);
  const fire = cleanDigits(entry.Fire?.All);
  const ambulance = cleanDigits(entry.Ambulance?.All);
  const dispatch = cleanDigits(entry.Dispatch?.All);

  const all = uniqueTels([dispatch, police, fire, ambulance]);
  if (all.length === 0) {
    if (entry.Member_112) {
      return [{ tel: "112", zh: "緊急服務", en: "Emergency services" }];
    }
    return [{ tel: "112", zh: "緊急服務（請核實當地號碼）", en: "Emergency (verify local number)" }];
  }

  if (all.length === 1) {
    return [
      {
        tel: all[0]!,
        zh: "警察、消防、救護車",
        en: "Police, fire, ambulance",
      },
    ];
  }

  const numbers: EmsNumber[] = [];
  const pushRole = (tels: string[], zh: string, en: string) => {
    for (const tel of uniqueTels([tels])) {
      if (!numbers.some((n) => n.tel === tel && n.en === en)) {
        numbers.push({ tel, zh, en });
      }
    }
  };

  pushRole(ambulance, "救護車", "Ambulance");
  pushRole(fire, "消防", "Fire");
  pushRole(police, "警察", "Police");
  if (numbers.length === 0) {
    for (const tel of all) {
      numbers.push({ tel, zh: "緊急服務", en: "Emergency services" });
    }
  }
  return numbers;
}

/** Curated labels beat Intl / Wikipedia country names (e.g. TW, CN). */
const LABEL_OVERRIDES: Record<string, { zh: string; en: string }> = {
  HK: { zh: "香港", en: "Hong Kong" },
  MO: { zh: "澳門", en: "Macau" },
  TW: { zh: "台灣", en: "Taiwan" },
  CN: { zh: "中國內地", en: "Mainland China" },
};

function regionLabel(iso: string, enFromWiki: string): { zh: string; en: string } {
  const curated = LABEL_OVERRIDES[iso];
  if (curated) return curated;
  let en = enFromWiki;
  let zh = enFromWiki;
  try {
    en = new Intl.DisplayNames(["en"], { type: "region" }).of(iso) ?? enFromWiki;
    zh = new Intl.DisplayNames(["zh-Hant"], { type: "region" }).of(iso) ?? enFromWiki;
  } catch {
    /* Intl unavailable in some runtimes */
  }
  return { en, zh };
}

function wikiToRegionInfo(entry: WikiEntry): RegionInfo {
  const iso = entry.Country.ISOCode;
  const name = entry.Country.Name;
  return {
    label: regionLabel(iso, name),
    numbers: wikiToNumbers(entry),
  };
}

/** Hand-verified rows override Wikipedia-derived data (same ISO keys). */
export const EMS_OVERRIDES: Record<string, RegionInfo> = {
  HK: {
    label: { zh: "香港", en: "Hong Kong" },
    numbers: [{ tel: "999", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }],
  },
  MO: {
    label: { zh: "澳門", en: "Macau" },
    numbers: [{ tel: "999", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }],
  },
  TW: {
    label: { zh: "台灣", en: "Taiwan" },
    numbers: [
      { tel: "119", zh: "消防、救護車", en: "Fire, ambulance" },
      { tel: "110", zh: "警察", en: "Police" },
    ],
  },
  CN: {
    label: { zh: "中國內地", en: "Mainland China" },
    numbers: [
      { tel: "120", zh: "救護車", en: "Ambulance" },
      { tel: "110", zh: "警察", en: "Police" },
      { tel: "119", zh: "消防", en: "Fire" },
    ],
  },
  SG: {
    label: { zh: "新加坡", en: "Singapore" },
    numbers: [
      { tel: "995", zh: "救護車、消防", en: "Ambulance, fire" },
      { tel: "999", zh: "警察", en: "Police" },
    ],
  },
  JP: {
    label: { zh: "日本", en: "Japan" },
    numbers: [
      { tel: "119", zh: "救護車、消防", en: "Ambulance, fire" },
      { tel: "110", zh: "警察", en: "Police" },
    ],
  },
  GB: {
    label: { zh: "英國", en: "United Kingdom" },
    numbers: [{ tel: "999", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }],
  },
  US: {
    label: { zh: "美國", en: "United States" },
    numbers: [{ tel: "911", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }],
  },
  CA: {
    label: { zh: "加拿大", en: "Canada" },
    numbers: [{ tel: "911", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }],
  },
  AU: {
    label: { zh: "澳洲", en: "Australia" },
    numbers: [{ tel: "000", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }],
  },
  TH: {
    label: { zh: "泰國", en: "Thailand" },
    numbers: [
      { tel: "191", zh: "警察", en: "Police" },
      { tel: "1669", zh: "救護車、消防", en: "Ambulance, fire" },
    ],
  },
};

function buildIsoEms(): Record<string, RegionInfo> {
  const out: Record<string, RegionInfo> = {};
  for (const entry of wikiEntries) {
    const iso = entry.Country?.ISOCode;
    if (!iso || iso.length !== 2) continue;
    out[iso] = wikiToRegionInfo(entry);
  }
  return { ...out, ...EMS_OVERRIDES };
}

export const EMS_FROM_ISO = buildIsoEms();

export function isoEmsCount(): number {
  return Object.keys(EMS_FROM_ISO).length;
}
