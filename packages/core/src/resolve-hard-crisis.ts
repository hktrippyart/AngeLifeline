import { inferCrisisFocus, type CrisisFocus } from "./crisis-focus";
import { assessCrisisWithGemini } from "./gemini-crisis-triage";
import { detectHardCrisis } from "./hard-crisis-detection";

export type HardCrisisResolution = {
  hardCrisis: boolean;
  crisisFocus: CrisisFocus;
  rulesMatch: boolean;
  geminiEscalate: boolean;
};

/** Hard crisis for overlay + host chat: rules first, then Gemini triage. */
export async function resolveHardCrisis(options: {
  lastUserText: string;
  chatSnippet: string;
}): Promise<HardCrisisResolution> {
  const rulesMatch = detectHardCrisis(options.lastUserText);
  const chatForFocus = `${options.lastUserText}\n${options.chatSnippet}`;

  if (rulesMatch) {
    return {
      hardCrisis: true,
      crisisFocus: inferCrisisFocus(chatForFocus),
      rulesMatch: true,
      geminiEscalate: false,
    };
  }

  const triage = await assessCrisisWithGemini({
    chatSnippet: options.chatSnippet,
  });

  const geminiEscalate = Boolean(triage?.escalate);
  return {
    hardCrisis: geminiEscalate,
    crisisFocus: triage?.crisisFocus ?? inferCrisisFocus(chatForFocus),
    rulesMatch: false,
    geminiEscalate,
  };
}
