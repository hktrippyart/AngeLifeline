import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { CrisisFocus } from "./crisis-focus";
import { sanitizeGeminiGenerationConfig } from "./gemini-generation-config";

const triageSchema = z.object({
  tier: z.enum(["red", "yellow", "none"]),
  crisisFocus: z.enum(["medical", "suicide", "mixed", "general"]),
});

export type GeminiCrisisTriage = {
  escalate: boolean;
  crisisFocus: CrisisFocus;
  tier: "red" | "yellow" | "none";
  source: "gemini";
};

function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(raw.slice(start, end + 1)) as unknown;
  }
  return JSON.parse(raw) as unknown;
}

/**
 * Server-only. Semantic red / yellow triage when keyword lists miss paraphrases
 * (Cantonese colloquial, typos, indirect wording). Same GEMINI_API_KEY as venue lookup.
 */
export async function assessCrisisWithGemini(options: {
  chatSnippet: string;
}): Promise<GeminiCrisisTriage | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.GEMINI_MODEL_NAME?.trim() || "gemini-3.6-flash";
  const snippet = options.chatSnippet.trim().slice(0, 1200);
  if (!snippet) return null;

  const prompt = `You triage peer-support chat for harm reduction (not diagnosis).

Recent user messages (newest last; may include typos or Cantonese 廣東話 colloquial):
"""
${snippet}
"""

Classify the **latest** user turn in context using this rubric:

**RED (tier "red") — open emergency overlay; stop normal coaching**
- Medical red flags: severe breathing trouble, choking, chest pain, heart racing with distress, overdose, seizure/convulsion, unconscious/can't wake, collapse, vomiting blood, dangerous overheating, uncontrolled bleeding, serious injury.
- Psych red flags: active suicide/self-harm plan with intent, imminent harm to others, complete loss of safety that cannot be grounded online.
- Treat colloquial medical distress as RED even if wording is non-standard (e.g. 透唔到氣, 抖到冇氣, 心跳好快好驚, shaking until breathless).

**YELLOW (tier "yellow") — support + grounding; no emergency overlay**
- Anxiety, panic, tears, overwhelm, looping thoughts, confusion that still tracks conversation, fear without clear medical danger.

**NONE (tier "none")**
- Normal chat, integration, education, or role-play without real-time danger.

Reply with ONLY one JSON object, no markdown:
{"tier":"red"|"yellow"|"none","crisisFocus":"medical"|"suicide"|"mixed"|"general"}

Rules:
- crisisFocus "medical" for body/EMS-type red; "suicide" for self-harm/suicide red; "mixed" if both; "general" for yellow/none or unclear.
- When unsure between yellow and red for possible medical danger, choose **red**.
- Hyperbole alone ("dying of embarrassment") → yellow or none, not red.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: sanitizeGeminiGenerationConfig(model, {
        temperature: 0.1,
        maxOutputTokens: 128,
      }),
    });

    const text = response.text?.trim();
    if (!text) return null;

    const parsed = triageSchema.safeParse(parseJsonFromModel(text));
    if (!parsed.success) return null;

    const { tier, crisisFocus } = parsed.data;
    return {
      escalate: tier === "red",
      crisisFocus,
      tier,
      source: "gemini",
    };
  } catch {
    return null;
  }
}
