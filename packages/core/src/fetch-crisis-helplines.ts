import type { CrisisHelplinesResult } from "./crisis-helpline-types";
import type { CrisisFocus } from "./crisis-focus";
import type { EmergencyRegion } from "./emergency-routing";
import { getAngeLifelineApiPaths } from "./client-config";
import type { UiLocale } from "./locale";

export async function fetchCrisisHelplines(options: {
  chatSnippet: string;
  regionHint?: string;
  emergencyRegion?: EmergencyRegion;
  countryCode?: string;
  crisisFocus?: CrisisFocus;
  uiLocale?: UiLocale;
}): Promise<CrisisHelplinesResult> {
  try {
    const { crisisHelplines } = getAngeLifelineApiPaths();
    const res = await fetch(crisisHelplines, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      return { configured: false, needsLocation: true, lines: [] };
    }
    return (await res.json()) as CrisisHelplinesResult;
  } catch {
    return { configured: false, needsLocation: true, lines: [] };
  }
}
