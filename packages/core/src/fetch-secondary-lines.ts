import { getAngeLifelineApiPaths } from "./client-config";
import { resolveLiveEventLookup } from "./festival-places";
import type { PlacesVenueResolved } from "./google-places-lookup";
import {
  extractExplicitRegionHint,
  extractPlaceHints,
} from "./place-hints";
import { placeLookupFromKeywords } from "./place-keywords";
import type { SecondaryLine } from "./routing-policy";
import { sortSecondaryLines } from "./routing-policy";

export type SecondaryLinesResult = {
  lines: SecondaryLine[];
  resolved?: PlacesVenueResolved;
  geminiUsed?: boolean;
};

async function fetchPlacesVenue(
  placeHint: string,
  options: { regionHint?: string; chatSnippet: string },
): Promise<SecondaryLinesResult> {
  try {
    const { venueLookup } = getAngeLifelineApiPaths();
    const res = await fetch(venueLookup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeHint,
        regionHint: options.regionHint,
        chatSnippet: options.chatSnippet.slice(0, 500),
      }),
    });
    if (!res.ok) return { lines: [] };
    const data = (await res.json()) as {
      configured?: boolean;
      lines?: SecondaryLine[];
      resolved?: PlacesVenueResolved;
      geminiUsed?: boolean;
    };
    return {
      lines: data.lines ?? [],
      resolved: data.resolved,
      geminiUsed: data.geminiUsed,
    };
  } catch {
    return { lines: [] };
  }
}

function pickPlaceHint(chatSnippet: string): string | undefined {
  const liveEvent = resolveLiveEventLookup(chatSnippet);
  const keywordPlace = placeLookupFromKeywords(chatSnippet);
  const hints = extractPlaceHints(chatSnippet);

  return (
    liveEvent?.placeHint ??
    keywordPlace?.placeHint ??
    hints.find(
      (h) =>
        h.length >= 2 &&
        !/^(hong kong|hk|japan|thailand|kowloon|central)$/i.test(h),
    ) ??
    hints[0]
  );
}

function pickPlaceHintOrRegion(chatSnippet: string): string | undefined {
  return (
    pickPlaceHint(chatSnippet) ?? extractExplicitRegionHint(chatSnippet)
  );
}

export function crisisSearchQuery(chatSnippet: string): string {
  const picked = pickPlaceHintOrRegion(chatSnippet);
  if (picked) return picked;
  const line = chatSnippet
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length >= 2);
  return (line ?? chatSnippet.trim()).slice(0, 120);
}

/** Gemini search + Places on every lifeline refresh when chat text exists. */
export async function resolveSecondaryLines(options: {
  chatSnippet: string;
}): Promise<SecondaryLinesResult> {
  const snippet = options.chatSnippet.trim();
  if (!snippet) {
    return { lines: [] };
  }
  const placeHint = crisisSearchQuery(snippet);

  // Only bias search when the user explicitly named a country/area in chat.
  const regionHint = extractExplicitRegionHint(snippet);

  const { lines, resolved, geminiUsed } = await fetchPlacesVenue(placeHint, {
    regionHint,
    chatSnippet: snippet,
  });
  return { lines: sortSecondaryLines(lines), resolved, geminiUsed };
}

export function hasResolvablePlaceHint(chatSnippet: string): boolean {
  return Boolean(
    pickPlaceHint(chatSnippet) ?? extractExplicitRegionHint(chatSnippet),
  );
}
