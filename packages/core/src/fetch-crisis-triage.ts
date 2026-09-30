import { getAngeLifelineApiPaths } from "./client-config";
import type { HardCrisisResolution } from "./resolve-hard-crisis";

/** Client: crisis gate via host-mounted POST route (@angelifeline/next/crisis-triage). */
export async function fetchCrisisTriage(options: {
  lastUserText: string;
  chatSnippet: string;
}): Promise<HardCrisisResolution | null> {
  const { crisisTriage } = getAngeLifelineApiPaths();
  try {
    const res = await fetch(crisisTriage, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastUserText: options.lastUserText,
        chatSnippet: options.chatSnippet,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as HardCrisisResolution;
  } catch {
    return null;
  }
}
