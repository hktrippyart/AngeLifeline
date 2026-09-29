import {
  emergencyDisplayFromCountryCode,
  inferCountryCodeFromChat,
} from "./country-emergency";
import { resolveVenueContextWithGemini } from "./gemini-venue-context";
import {
  lookupPlacesVenue,
  type PlacesVenueResult,
} from "./google-places-lookup";
import type { VenueLookupRequest } from "./routing-policy";
import { emergencyRegionFromCountryCode } from "./emergency-routing";

export type CrisisVenueResult = PlacesVenueResult & {
  geminiUsed: boolean;
};

function mergeResolved(
  places: PlacesVenueResult,
  geminiCtx: NonNullable<
    Awaited<ReturnType<typeof resolveVenueContextWithGemini>>
  >,
  chatSnippet?: string,
): PlacesVenueResult {
  const fromChat = chatSnippet?.trim()
    ? inferCountryCodeFromChat(chatSnippet)
    : undefined;
  const placesCc = places.resolved.countryCode;
  const geminiCc = geminiCtx.countryCode;

  let countryCode: string | undefined;
  if (fromChat) {
    countryCode = fromChat;
  } else if (placesCc && geminiCc && placesCc !== geminiCc) {
    // Search grounding beats the first ambiguous Places POI (e.g. US "Miracle" vs TW festival).
    countryCode = geminiCc;
  } else {
    countryCode = placesCc ?? geminiCc;
  }

  const placesAddressMatchesCountry =
    Boolean(placesCc && countryCode && placesCc === countryCode);
  const regionHint = placesAddressMatchesCountry
    ? (places.resolved.regionHint ?? geminiCtx.regionHint)
    : (geminiCtx.regionHint ?? places.resolved.regionHint);

  const emergencyNumber =
    (countryCode
      ? emergencyDisplayFromCountryCode(countryCode, regionHint)?.number
      : undefined) ??
    geminiCtx.emergencyNumber ??
    places.resolved.emergencyNumber;

  const emergencyRegion =
    (countryCode ? emergencyRegionFromCountryCode(countryCode) : undefined) ??
    geminiCtx.emergencyRegion ??
    places.resolved.emergencyRegion;

  return {
    line: places.line,
    resolved: {
      countryCode,
      regionHint,
      emergencyRegion,
      emergencyNumber,
    },
  };
}

/** Gemini + Google Search grounding, then Places (New) when a Maps key is set. */
export async function resolveVenueForCrisis(
  req: VenueLookupRequest,
  placesApiKey?: string,
): Promise<CrisisVenueResult> {
  let placeHint = req.placeHint;
  let regionHint = req.regionHint;
  let geminiCtx: Awaited<ReturnType<typeof resolveVenueContextWithGemini>> =
    null;

  if (req.chatSnippet?.trim()) {
    geminiCtx = await resolveVenueContextWithGemini({
      chatSnippet: req.chatSnippet,
      placeHint: req.placeHint,
    });
    if (geminiCtx) {
      if (geminiCtx.placeQuery) placeHint = geminiCtx.placeQuery;
      if (!regionHint && geminiCtx.regionHint) regionHint = geminiCtx.regionHint;
    }
  }

  if (!placesApiKey) {
    if (!geminiCtx) {
      return { line: null, resolved: {}, geminiUsed: false };
    }
    return {
      line: null,
      resolved: {
        countryCode: geminiCtx.countryCode,
        regionHint: geminiCtx.regionHint,
        emergencyRegion: geminiCtx.emergencyRegion,
        emergencyNumber: geminiCtx.emergencyNumber,
      },
      geminiUsed: true,
    };
  }

  const places = await lookupPlacesVenue(
    { placeHint, regionHint },
    placesApiKey,
  );

  if (!geminiCtx) {
    const fromChat = req.chatSnippet?.trim()
      ? inferCountryCodeFromChat(req.chatSnippet)
      : undefined;
    if (
      fromChat &&
      places.resolved.countryCode &&
      fromChat !== places.resolved.countryCode
    ) {
      const regionHint =
        places.resolved.regionHint?.toLowerCase().includes("taiwan") ||
        places.resolved.regionHint?.includes("台")
          ? places.resolved.regionHint
          : undefined;
      return {
        ...places,
        resolved: {
          countryCode: fromChat,
          regionHint: regionHint ?? places.resolved.regionHint,
          emergencyRegion: emergencyRegionFromCountryCode(fromChat),
          emergencyNumber: emergencyDisplayFromCountryCode(
            fromChat,
            regionHint,
          )?.number,
        },
        geminiUsed: false,
      };
    }
    return { ...places, geminiUsed: false };
  }

  return {
    ...mergeResolved(places, geminiCtx, req.chatSnippet),
    geminiUsed: true,
  };
}
