import {
  emergencyRegionFromRegionHint,
  inferEmergencyRegion,
  type EmergencyRegion,
} from "./emergency-routing";
import { hasResolvablePlaceHint } from "./fetch-secondary-lines";
import { resolveLiveEventLookup } from "./festival-places";
import { extractRegionHint } from "./place-hints";
import { placeLookupFromKeywords } from "./place-keywords";

export function hasLocationContextFromText(text: string): boolean {
  if (inferEmergencyRegion(text)) return true;
  if (extractRegionHint(text)) return true;
  if (resolveLiveEventLookup(text)) return true;
  if (placeLookupFromKeywords(text)) return true;
  if (hasResolvablePlaceHint(text)) return true;
  return false;
}

export function hasLocationContext(options: {
  chatSnippet: string;
  regionHint?: string;
  emergencyRegion?: EmergencyRegion;
  countryCode?: string;
}): boolean {
  if (options.countryCode?.trim()) return true;
  if (options.emergencyRegion) return true;
  if (emergencyRegionFromRegionHint(options.regionHint)) return true;
  if (hasLocationContextFromText(options.chatSnippet)) return true;
  return false;
}
