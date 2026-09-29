import type { EmergencyRegion } from "./emergency-routing";

/**
 * Keyword → canonical Places search name (no stored phones).
 * Country/EMS from live Places address; fallbacks only if API fails.
 */
export type PlaceKeywordEntry = {
  keywords: string[];
  placeHint: string;
  fallbackRegionHint?: string;
  fallbackEmergencyRegion?: EmergencyRegion;
  fallbackHelplineCountry?: string;
};

export const PLACE_KEYWORD_ENTRIES: PlaceKeywordEntry[] = [
  {
    keywords: ["w hotel", "w館", "w 酒店", "whotel"],
    placeHint: "W Hotel",
    fallbackRegionHint: "Hong Kong",
    fallbackEmergencyRegion: "hk",
    fallbackHelplineCountry: "hk",
  },
  {
    keywords: ["disneyland", "迪士尼"],
    placeHint: "Disneyland",
  },
  {
    keywords: ["disney"],
    placeHint: "Disney theme park",
  },
];

export function placeLookupFromKeywords(
  text: string,
): Pick<
  PlaceKeywordEntry,
  | "placeHint"
  | "fallbackRegionHint"
  | "fallbackEmergencyRegion"
  | "fallbackHelplineCountry"
> | null {
  const lower = text.toLowerCase();
  for (const entry of PLACE_KEYWORD_ENTRIES) {
    if (
      entry.keywords.some(
        (kw) => lower.includes(kw.toLowerCase()) || text.includes(kw),
      )
    ) {
      return {
        placeHint: entry.placeHint,
        fallbackRegionHint: entry.fallbackRegionHint,
        fallbackEmergencyRegion: entry.fallbackEmergencyRegion,
        fallbackHelplineCountry: entry.fallbackHelplineCountry,
      };
    }
  }
  return null;
}

export function findPlaceKeywordByPlaceHint(
  placeHint: string,
): PlaceKeywordEntry | undefined {
  const norm = placeHint.trim().toLowerCase();
  return PLACE_KEYWORD_ENTRIES.find(
    (e) => e.placeHint.toLowerCase() === norm,
  );
}
