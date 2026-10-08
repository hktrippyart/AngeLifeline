import { decide, detectRules, type Category } from "./angelifeline-rules";
import { maskPII } from "./angelifeline-mask";
import { judgeMaskedText } from "./angelifeline-judge-server";
import { inferCrisisFocus, type CrisisFocus } from "./crisis-focus";
import { detectHardCrisis } from "./hard-crisis-detection";

export type HardCrisisResolution = {
  hardCrisis: boolean;
  softPrompt: boolean;
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

function judgeLevelToModelProb(
  level: "none" | "concern" | "urgent" | undefined,
): number | null {
  if (level === "urgent") return 0.9;
  if (level === "concern") return 0.05;
  if (level === "none") return 0;
  return null;
}

/**
 * Server crisis gate: local rules on raw text first, then masked LLM judge, then merge.
 */
export async function resolveHardCrisis(options: {
  lastUserText: string;
  chatSnippet: string;
}): Promise<HardCrisisResolution> {
  const ruleResult = detectRules(options.lastUserText);
  const legacyMatch = detectHardCrisis(options.lastUserText);
  const chatForFocus = `${options.lastUserText}\n${options.chatSnippet}`;

  if (ruleResult.level === "high") {
    return {
      hardCrisis: true,
      softPrompt: false,
      crisisFocus: crisisFocusFromCategories(ruleResult.categories, chatForFocus),
      rulesMatch: true,
      geminiEscalate: false,
    };
  }

  const masked = maskPII(options.lastUserText);
  const judge = await judgeMaskedText(masked.text);
  const modelProb =
    judge.status === "ok"
      ? judgeLevelToModelProb(judge.verdict.level)
      : null;
  const decision = decide(ruleResult, modelProb);

  const geminiEscalate =
    judge.status === "ok" && judge.verdict.level === "urgent";
  const hardCrisis = legacyMatch || decision.trigger || geminiEscalate;
  const softPrompt =
    !hardCrisis &&
    (decision.softPrompt ||
      (judge.status === "ok" && judge.verdict.level === "concern"));

  const categories = new Set(ruleResult.categories);
  if (judge.status === "ok") {
    const cat = judge.verdict.category;
    if (cat === "self_harm" || cat === "violence" || cat === "medical") {
      categories.add(cat);
    }
  }

  return {
    hardCrisis,
    softPrompt,
    crisisFocus:
      crisisFocusFromCategories(Array.from(categories) as Category[], chatForFocus),
    rulesMatch:
      legacyMatch ||
      ruleResult.level === "high" ||
      decision.reason === "rule_high" ||
      decision.reason === "rule_review+model" ||
      decision.reason === "rule_review_model_unavailable",
    geminiEscalate,
  };
}

/** Host UI: open AngeLifeline overlay when triage says hard crisis (after fetchCrisisTriage). */
export function shouldOpenAngeLifelineOverlay(
  resolution: HardCrisisResolution,
): boolean {
  return resolution.hardCrisis;
}
