import {
  decide,
  detectRules,
  type Category,
} from "./angelifeline-rules";
import { inferCrisisFocus, type CrisisFocus } from "./crisis-focus";
import {
  assessCrisisWithGemini,
  type GeminiCrisisTriage,
} from "./gemini-crisis-triage";
import { detectHardCrisis } from "./hard-crisis-detection";

export type HardCrisisResolution = {
  hardCrisis: boolean;
  crisisFocus: CrisisFocus;
  rulesMatch: boolean;
  geminiEscalate: boolean;
};

function crisisFocusFromCategories(
  categories: Category[],
  fallbackText: string,
): CrisisFocus {
  if (categories.length === 0) return inferCrisisFocus(fallbackText);
  const self = categories.includes("self_harm");
  const med = categories.includes("medical");
  if (self && med) return "mixed";
  if (self) return "suicide";
  if (med) return "medical";
  return "general";
}

function geminiTierToModelProb(triage: GeminiCrisisTriage | null): number | null {
  if (!triage) return null;
  if (triage.tier === "red") return 0.9;
  if (triage.tier === "yellow") return 0.05;
  return 0;
}

function rulesPathMatch(
  legacyMatch: boolean,
  ruleLevel: ReturnType<typeof detectRules>["level"],
  decisionReason: ReturnType<typeof decide>["reason"],
): boolean {
  if (legacyMatch || ruleLevel === "high") return true;
  return (
    decisionReason === "rule_review+model" ||
    decisionReason === "rule_review_model_unavailable"
  );
}

/**
 * Overlay + host chat crisis gate: angelfeline-rules first, legacy keywords,
 * then Gemini semantic triage on recent user context (`chatSnippet`).
 */
export async function resolveHardCrisis(options: {
  lastUserText: string;
  chatSnippet: string;
}): Promise<HardCrisisResolution> {
  const ruleResult = detectRules(options.lastUserText);
  const legacyMatch = detectHardCrisis(options.lastUserText);
  const chatForFocus = `${options.lastUserText}\n${options.chatSnippet}`;

  const triage = await assessCrisisWithGemini({
    chatSnippet: options.chatSnippet,
  });
  const geminiEscalate = Boolean(triage?.escalate);
  const modelProb = geminiTierToModelProb(triage);
  const decision = decide(ruleResult, modelProb);

  const hardCrisis =
    legacyMatch || decision.trigger || geminiEscalate;
  const rulesMatch = rulesPathMatch(
    legacyMatch,
    ruleResult.level,
    decision.reason,
  );

  const focusFromRules = crisisFocusFromCategories(
    ruleResult.categories,
    chatForFocus,
  );

  return {
    hardCrisis,
    crisisFocus: triage?.crisisFocus ?? focusFromRules,
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
