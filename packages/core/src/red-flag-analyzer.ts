import type { CrisisFocus } from "./crisis-focus";
import { inferCrisisFocus } from "./crisis-focus";
import type { EmergencyRegion } from "./emergency-routing";

export type RedFlagAnalysis = {
  triggered: boolean;
  highSeverity: boolean;
  preferHongKong: boolean;
  matchedTerms: string[];
  crisisFocus: CrisisFocus;
  /** From chat text (e.g. Hong Kong) — not from VPN/IP. */
  regionHint?: string;
  emergencyRegion?: EmergencyRegion;
  /** ISO country from search / Places — drives EMS outside legacy keyword buckets. */
  countryCode?: string;
  emergencyNumber?: string;
  locationKnown: boolean;
};

const EN_TERMS = [
  "panic",
  "heart attack",
  "suffocating",
  "can't breathe",
  "cant breathe",
  "cannot breathe",
  "overdose",
  "suicide",
  "kill myself",
  "help me",
  "emergency",
  "911",
  "999",
];

const ZH_TERMS = [
  "痛",
  "死",
  "救命",
  "窒息",
  "喘唔到氣",
  "喘不到氣",
  "自殺",
  "想死",
  "過量",
  "驚",
  "好驚",
  "panic",
];

const HIGH_SEVERITY = [
  "heart attack",
  "suffocating",
  "can't breathe",
  "cant breathe",
  "cannot breathe",
  "overdose",
  "suicide",
  "kill myself",
  "窒息",
  "喘唔到氣",
  "想死",
  "自殺",
  "救命",
];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

export function analyzeForRedFlag(text: string): RedFlagAnalysis {
  const n = normalize(text);
  const matchedTerms: string[] = [];

  for (const term of EN_TERMS) {
    if (n.includes(term)) matchedTerms.push(term);
  }
  for (const term of ZH_TERMS) {
    if (text.includes(term) || n.includes(term.toLowerCase())) {
      matchedTerms.push(term);
    }
  }

  const preferHongKong = ZH_TERMS.some(
    (t) => text.includes(t) || n.includes(t.toLowerCase()),
  );

  const highSeverity = matchedTerms.some((t) =>
    HIGH_SEVERITY.includes(t.toLowerCase()),
  );

  return {
    triggered: matchedTerms.length > 0,
    highSeverity,
    preferHongKong,
    matchedTerms,
    crisisFocus: inferCrisisFocus(text),
    locationKnown: false, // set in PeerChat from chat context
  };
}
