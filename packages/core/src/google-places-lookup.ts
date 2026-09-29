import { emergencyDisplayFromCountryCode } from "./country-emergency";
import { emergencyRegionFromCountryCode } from "./emergency-routing";
import { venueFallbackForPlaceHint } from "./venue-fallback";
import type { SecondaryLine, VenueLookupRequest } from "./routing-policy";
import type { EmergencyRegion } from "./emergency-routing";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type PlacesTextSearchResponse = {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
  }>;
};

export type PlacesVenueResolved = {
  countryCode?: string;
  regionHint?: string;
  emergencyRegion?: EmergencyRegion;
  /** Primary EMS digits for country (Places address or search). */
  emergencyNumber?: string;
};

export type PlacesVenueResult = {
  line: SecondaryLine | null;
  resolved: PlacesVenueResolved;
};

function countryFromComponents(
  components: AddressComponent[] | undefined,
): string | undefined {
  if (!components?.length) return undefined;
  for (const c of components) {
    if (c.types?.includes("country") && c.shortText?.trim()) {
      return c.shortText.trim().toUpperCase();
    }
  }
  return undefined;
}

function fallbackResolved(req: VenueLookupRequest): PlacesVenueResolved {
  return venueFallbackForPlaceHint(req.placeHint);
}

/** Server-only. Live text search — current address/country from Places when regionHint omitted. */
export async function lookupPlacesVenue(
  req: VenueLookupRequest,
  apiKey: string,
): Promise<PlacesVenueResult> {
  const textQuery = req.regionHint
    ? `${req.placeHint}, ${req.regionHint}`
    : req.placeHint;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber",
    },
    body: JSON.stringify({ textQuery, pageSize: 1 }),
  });

  if (!res.ok) {
    return { line: null, resolved: fallbackResolved(req) };
  }

  const data = (await res.json()) as PlacesTextSearchResponse;
  const place = data.places?.[0];
  if (!place) {
    return { line: null, resolved: fallbackResolved(req) };
  }

  const countryCode = countryFromComponents(place.addressComponents);
  const emergencyRegion = countryCode
    ? emergencyRegionFromCountryCode(countryCode)
    : undefined;
  const regionHint =
    place.formattedAddress?.trim() ||
    place.addressComponents
      ?.find((c) => c.types?.includes("country"))
      ?.longText?.trim();

  const fb = fallbackResolved(req);
  const cc = countryCode ?? fb.countryCode;
  const hint = regionHint ?? fb.regionHint;
  const resolved: PlacesVenueResolved = {
    countryCode: cc,
    regionHint: hint,
    emergencyRegion: emergencyRegion ?? fb.emergencyRegion,
    emergencyNumber: cc
      ? emergencyDisplayFromCountryCode(cc, hint)?.number
      : undefined,
  };

  // Use Places for address/country only — top POI phones are often ski resorts,
  // hotels, etc., not on-site festival medical (misleading in crisis).
  return {
    line: null,
    resolved,
  };
}

/** @deprecated use lookupPlacesVenue */
export async function lookupPlacesLine(
  req: VenueLookupRequest,
  apiKey: string,
): Promise<SecondaryLine | null> {
  const result = await lookupPlacesVenue(req, apiKey);
  return result.line;
}
