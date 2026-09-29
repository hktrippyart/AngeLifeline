import { emergencyDisplayFromSearch } from "./country-emergency";
import { inferCrisisFocus } from "./crisis-focus";
import { crisisSearchQuery } from "./fetch-secondary-lines";
import { resolveLiveEventLookup } from "./festival-places";
import { hasLocationContext } from "./location-context";
import { placeLookupFromKeywords } from "./place-keywords";
import { extractExplicitRegionHint, extractRegionHint } from "./place-hints";
import { resolveCrisisHelplines } from "./resolve-crisis-helplines";
import { resolveVenueForCrisis } from "./resolve-venue-for-crisis";
import {
  emergencyRegionFromRegionHint,
  inferEmergencyRegion,
  resolveEmergencyDisplay,
  type EmergencyDisplay,
} from "./emergency-routing";
import type { UiLocale } from "./locale";

function placesApiKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
}

function buildLocationHints(chatSnippet: string) {
  const trimmed = chatSnippet.trim();
  const liveEvent = resolveLiveEventLookup(trimmed);
  const keywordPlace = placeLookupFromKeywords(trimmed);
  const regionHint =
    extractRegionHint(trimmed) ??
    keywordPlace?.fallbackRegionHint ??
    liveEvent?.event.fallbackRegionHint;
  const emergencyRegion =
    inferEmergencyRegion(trimmed) ??
    emergencyRegionFromRegionHint(regionHint) ??
    keywordPlace?.fallbackEmergencyRegion ??
    liveEvent?.event.fallbackEmergencyRegion;
  const locationKnown = hasLocationContext({
    chatSnippet: trimmed,
    regionHint,
    emergencyRegion,
  });
  return { regionHint, emergencyRegion, locationKnown };
}

function primaryEmsForOverlay(options: {
  chatSnippet: string;
  regionHint?: string;
  emergencyRegion?: ReturnType<typeof inferEmergencyRegion>;
  countryCode?: string;
  emergencyNumber?: string;
  locationKnown: boolean;
  crisisFocus: ReturnType<typeof inferCrisisFocus>;
  primaryFromHelplines?: EmergencyDisplay[];
}): EmergencyDisplay[] {
  if (options.primaryFromHelplines?.length) {
    return options.primaryFromHelplines;
  }
  const display = resolveEmergencyDisplay("en", {
    regionHint: options.regionHint,
    emergencyRegion: options.emergencyRegion,
    countryCode: options.countryCode,
    emergencyNumber: options.emergencyNumber,
    locationKnown: options.locationKnown,
    withholdEmsWithoutLocation: options.crisisFocus === "suicide",
  });
  if (display.number && !display.locationUnknown) {
    return [display];
  }
  return [];
}

/** Same numbers as AngeLifeline — injected into crisis chat turns for the model to quote. */
export async function buildAngeLifelineNumbersBlockForChat(options: {
  chatSnippet: string;
  uiLocale: UiLocale;
}): Promise<string> {
  const snippet = options.chatSnippet.trim();
  if (!snippet) return "";

  const crisisFocus = inferCrisisFocus(snippet);
  let { regionHint, emergencyRegion, locationKnown } =
    buildLocationHints(snippet);

  let countryCode: string | undefined;
  let emergencyNumber: string | undefined;

  const skipVenue =
    crisisFocus === "suicide" && !hasLocationContext({ chatSnippet: snippet, regionHint, emergencyRegion });

  if (!skipVenue && (placesApiKey() || process.env.GEMINI_API_KEY?.trim())) {
    try {
      const resolved = (
        await resolveVenueForCrisis(
          {
            placeHint: crisisSearchQuery(snippet),
            regionHint: extractExplicitRegionHint(snippet),
            chatSnippet: snippet,
          },
          placesApiKey(),
        )
      ).resolved;
      regionHint = resolved.regionHint ?? regionHint;
      emergencyRegion = resolved.emergencyRegion ?? emergencyRegion;
      countryCode = resolved.countryCode;
      emergencyNumber = resolved.emergencyNumber;
      if (resolved.countryCode || resolved.regionHint || resolved.emergencyRegion) {
        locationKnown = true;
      }
    } catch {
      // keyword / festival fallbacks only
    }
  }

  const helplines = await resolveCrisisHelplines({
    chatSnippet: snippet,
    regionHint,
    emergencyRegion,
    countryCode,
    crisisFocus,
    uiLocale: options.uiLocale,
  });

  const emsFromSearch =
    countryCode || emergencyNumber
      ? emergencyDisplayFromSearch({
          countryCode,
          regionHint,
          emergencyNumber,
        })
      : undefined;

  const ems = primaryEmsForOverlay({
    chatSnippet: snippet,
    regionHint,
    emergencyRegion,
    countryCode: countryCode ?? helplines.countryCode?.toUpperCase(),
    emergencyNumber,
    locationKnown,
    crisisFocus,
    primaryFromHelplines:
      helplines.primaryEmergency && helplines.primaryEmergency.length > 0
        ? helplines.primaryEmergency
        : emsFromSearch
          ? [emsFromSearch]
          : undefined,
  });

  const zh = options.uiLocale === "zh-Hant";
  const lines: string[] = [];

  if (zh) {
    lines.push(
      "【必須寫入你回覆內文 — 與 AngeLifeline 畫面相同嘅號碼，用清晰列表或段落逐個列出，唔好只講「睇畫面」】",
    );
  } else {
    lines.push(
      "[MUST appear inside your reply — same numbers as the AngeLifeline overlay; list each one clearly in the message, not only “see the screen”]",
    );
  }

  if (ems.length > 0) {
    lines.push(zh ? "緊急服務：" : "Emergency services:");
    for (const d of ems) {
      lines.push(`- ${d.number} — ${zh ? d.labelZh : d.labelEn}`);
      const sub = zh ? d.subnoteZh : d.subnoteEn;
      if (sub) lines.push(`  (${sub})`);
    }
  } else if (crisisFocus === "suicide" && !locationKnown) {
    lines.push(
      zh
        ? "（未確定地點 — 若語言推斷熱線已在下列，一併寫出）"
        : "(Location not confirmed — if crisis lines below apply, include them.)",
    );
  }

  const showCrisis =
    crisisFocus === "suicide" || crisisFocus === "mixed";
  if (showCrisis && helplines.lines.length > 0) {
    lines.push(
      zh ? "自殺／情緒危機熱線：" : "Suicide & crisis support lines:",
    );
    for (const line of helplines.lines) {
      const label = zh ? line.labelZh : line.labelEn;
      if (line.tel) {
        lines.push(`- ${label}: ${line.tel}`);
      } else if (line.sms) {
        lines.push(`- ${label} (SMS): ${line.sms}`);
      } else {
        lines.push(`- ${label}`);
      }
    }
  }

  lines.push("https://findahelpline.com");

  return lines.join("\n");
}
