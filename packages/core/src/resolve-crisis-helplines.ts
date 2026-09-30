import {
  fallbackSuicideHelplines,
  fallbackSuicideHelplinesForChineseLocale,
} from "./crisis-helpline-fallback";
import type { CrisisHelplinesResult } from "./crisis-helpline-types";
import type { CrisisFocus } from "./crisis-focus";
import {
  inferChineseCrisisHelplineLocale,
  primaryEmergencyDisplaysForChineseLocale,
} from "./crisis-language-locale";
import { inferHelplineCountryCode } from "./emergency-routing";
import { hasLocationContext } from "./location-context";
import type { UiLocale } from "./locale";
import {
  fetchThroughlineSuicideHelplines,
  throughlineConfigured,
} from "./throughline-helplines";

function isSuicideFocus(focus?: CrisisFocus): boolean {
  return focus === "suicide" || focus === "mixed";
}

export async function resolveCrisisHelplines(options: {
  chatSnippet: string;
  regionHint?: string;
  emergencyRegion?: import("./emergency-routing").EmergencyRegion;
  countryCode?: string;
  crisisFocus?: CrisisFocus;
  uiLocale?: UiLocale;
}): Promise<CrisisHelplinesResult> {
  const locationKnown = hasLocationContext(options);
  if (!locationKnown) {
    if (isSuicideFocus(options.crisisFocus)) {
      const chineseLocale = inferChineseCrisisHelplineLocale(
        options.chatSnippet,
        options.uiLocale,
        options.crisisFocus,
      );
      if (chineseLocale) {
        let lines = fallbackSuicideHelplinesForChineseLocale(chineseLocale);
        const slug =
          chineseLocale === "hant_multi" ? undefined : chineseLocale;
        if (slug && throughlineConfigured()) {
          const live = await fetchThroughlineSuicideHelplines(slug);
          if (live.length > 0) lines = live;
        }
        return {
          configured: true,
          needsLocation: true,
          countryCode: slug,
          primaryEmergency:
            primaryEmergencyDisplaysForChineseLocale(chineseLocale),
          lines,
        };
      }
    }
    return { configured: throughlineConfigured(), needsLocation: true, lines: [] };
  }

  const countryCode = inferHelplineCountryCode({
    chatSnippet: options.chatSnippet,
    regionHint: options.regionHint,
    emergencyRegion: options.emergencyRegion,
    countryCode: options.countryCode,
  });
  if (!countryCode) {
    return { configured: throughlineConfigured(), needsLocation: true, lines: [] };
  }

  let lines = await fetchThroughlineSuicideHelplines(countryCode);
  const configured = throughlineConfigured();
  if (lines.length === 0) {
    lines = fallbackSuicideHelplines(countryCode);
  }

  return {
    configured: configured || lines.length > 0,
    needsLocation: false,
    countryCode,
    lines,
  };
}
