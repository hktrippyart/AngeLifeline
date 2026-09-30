import { inferCrisisFocus, type CrisisFocus } from "./crisis-focus";
import { assessCrisisWithGemini } from "./gemini-crisis-triage";
import { detectHardCrisis } from "./hard-crisis-detection";

export type HardCrisisResolution = {
  hardCrisis: boolean;
  crisisFocus: CrisisFocus;
  rulesMatch: boolean;
  geminiEscalate: boolean;
};

/**
 * Overlay + host chat crisis gate: keyword fast-path OR Gemini semantic triage
 * on recent user context (`chatSnippet`). Requires `GEMINI_API_KEY` for paraphrases.
 */
export async function resolveHardCrisis(options: {
  lastUserText: string;
  chatSnippet: string;
}): Promise<HardCrisisResolution> {
  const rulesMatch = detectHardCrisis(options.lastUserText);
  const chatForFocus = `${options.lastUserText}\n${options.chatSnippet}`;

  const triage = await assessCrisisWithGemini({
    chatSnippet: options.chatSnippet,
  });

  const geminiEscalate = Boolean(triage?.escalate);
  const hardCrisis = rulesMatch || geminiEscalate;

  return {
    hardCrisis,
    crisisFocus:
      triage?.crisisFocus ??
      inferCrisisFocus(chatForFocus),
    rulesMatch,
    geminiEscalate,
  };
}

/** Host UI: open AngeLifeline overlay when triage says hard crisis (after fetchCrisisTriage). */
export function shouldOpenAngeLifelineOverlay(
  resolution: HardCrisisResolution,
): boolean {
  return resolution.hardCrisis;
}
