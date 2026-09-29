import {
  findEventByPlaceHint,
  type LiveSearchEvent,
} from "./festival-places";
import type { PlacesVenueResolved } from "./google-places-lookup";
import {
  findPlaceKeywordByPlaceHint,
  type PlaceKeywordEntry,
} from "./place-keywords";

function fromEntry(
  entry: Pick<
    LiveSearchEvent | PlaceKeywordEntry,
    | "fallbackRegionHint"
    | "fallbackEmergencyRegion"
    | "fallbackHelplineCountry"
  >,
): PlacesVenueResolved {
  if (!entry.fallbackEmergencyRegion && !entry.fallbackRegionHint) {
    return {};
  }
  return {
    countryCode: entry.fallbackHelplineCountry,
    regionHint: entry.fallbackRegionHint,
    emergencyRegion: entry.fallbackEmergencyRegion,
  };
}

/** Offline / Places-miss fallback for a canonical search name. */
export function venueFallbackForPlaceHint(
  placeHint: string,
): PlacesVenueResolved {
  const event = findEventByPlaceHint(placeHint);
  if (event) {
    const fb = fromEntry(event);
    if (fb.emergencyRegion || fb.regionHint) return fb;
  }
  const keyword = findPlaceKeywordByPlaceHint(placeHint);
  if (keyword) {
    const fb = fromEntry(keyword);
    if (fb.emergencyRegion || fb.regionHint) return fb;
  }
  return {};
}
