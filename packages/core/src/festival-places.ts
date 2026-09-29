import type { EmergencyRegion } from "./emergency-routing";

/**
 * Festival nicknames → canonical Places search name only.
 * Country/EMS come from live Places address (or fallbacks when API is off).
 */
export type LiveSearchEvent = {
  id: string;
  keywords: string[];
  placeHint: string;
  /** When GOOGLE_MAPS_API_KEY is missing or Places returns nothing */
  fallbackRegionHint?: string;
  fallbackEmergencyRegion?: EmergencyRegion;
  fallbackHelplineCountry?: string;
};

export const LIVE_SEARCH_EVENTS: LiveSearchEvent[] = [
  {
    id: "wonderfruit",
    keywords: ["wonderfruit", "wonder fruit"],
    placeHint: "Wonderfruit Festival",
    fallbackRegionHint: "Thailand",
    fallbackEmergencyRegion: "th",
    fallbackHelplineCountry: "th",
  },
  {
    id: "clockenflap",
    keywords: ["clockenflap", "clokenflap"],
    placeHint: "Clockenflap Festival",
    fallbackRegionHint: "Hong Kong",
    fallbackEmergencyRegion: "hk",
    fallbackHelplineCountry: "hk",
  },
  {
    id: "ozora",
    keywords: ["ozora"],
    placeHint: "Ozora Festival",
    fallbackRegionHint: "Hungary",
    fallbackEmergencyRegion: "eu",
    fallbackHelplineCountry: "hu",
  },
  {
    id: "burning-man",
    keywords: ["burning man", "black rock city", "black rock desert"],
    placeHint: "Burning Man",
    fallbackRegionHint: "Nevada, United States",
    fallbackEmergencyRegion: "us_ca",
    fallbackHelplineCountry: "us",
  },
  {
    id: "fuji-rock",
    keywords: ["fuji rock", "fujirock", "fuji-rock"],
    placeHint: "Fuji Rock Festival",
    fallbackRegionHint: "Niigata, Japan",
    fallbackEmergencyRegion: "jp",
    fallbackHelplineCountry: "jp",
  },
];

export function resolveLiveEventLookup(
  text: string,
): { placeHint: string; event: LiveSearchEvent } | null {
  const lower = text.toLowerCase();
  for (const event of LIVE_SEARCH_EVENTS) {
    if (event.keywords.some((kw) => lower.includes(kw))) {
      return { placeHint: event.placeHint, event };
    }
  }
  return null;
}

export function findEventByPlaceHint(placeHint: string): LiveSearchEvent | undefined {
  const norm = placeHint.trim().toLowerCase();
  return LIVE_SEARCH_EVENTS.find((e) => e.placeHint.toLowerCase() === norm);
}
