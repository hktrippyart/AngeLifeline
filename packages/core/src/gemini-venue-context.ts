import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { emergencyDisplayFromCountryCode } from "./country-emergency";
import {
  emergencyRegionFromCountryCode,
  emergencyRegionFromRegionHint,
} from "./emergency-routing";
import type { EmergencyRegion } from "./emergency-routing";
import { venueGroundingText } from "./angelifeline-venue-privacy";
import type { VenueLookupRequest } from "./routing-policy";

const venueContextSchema = z.object({
  placeQuery: z.string().min(1).max(120).nullish(),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .nullish(),
  regionHint: z.string().min(1).max(120).nullish(),
  emergencyNumber: z.string().min(2).max(8).nullish(),
});

export type GeminiVenueContext = {
  placeQuery?: string;
  countryCode?: string;
  regionHint?: string;
  emergencyNumber?: string;
  emergencyRegion?: EmergencyRegion;
  source: "gemini_search";
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

function looseParseFromText(
  text: string,
  snippet: string,
): GeminiVenueContext | null {
  const combined = `${text}\n${snippet}`.toLowerCase();
  const codeMatch = text.match(/"countryCode"\s*:\s*"([A-Za-z]{2})"/);
  let countryCode = codeMatch?.[1]?.toUpperCase();

  const regionMatch = text.match(/"regionHint"\s*:\s*"([^"]+)"/);
  let regionHint = regionMatch?.[1]?.trim();

  const placeMatch = text.match(/"placeQuery"\s*:\s*"([^"]+)"/);
  const placeQuery = placeMatch?.[1]?.trim();

  const emsMatch = text.match(/"emergencyNumber"\s*:\s*"([^"]+)"/);
  let emergencyNumber = emsMatch?.[1]?.replace(/\D/g, "");

  if (!countryCode && (combined.includes("goa") || combined.includes("india"))) {
    countryCode = "IN";
    regionHint = regionHint ?? "Goa, India";
  }

  if (!countryCode && !regionHint) return null;

  if (!emergencyNumber && countryCode) {
    emergencyNumber = emergencyDisplayFromCountryCode(
      countryCode,
      regionHint,
    )?.number;
  }

  const emergencyRegion =
    (countryCode ? emergencyRegionFromCountryCode(countryCode) : undefined) ??
    emergencyRegionFromRegionHint(regionHint);

  return {
    placeQuery: placeQuery ?? regionHint,
    countryCode,
    regionHint,
    emergencyNumber,
    emergencyRegion,
    source: "gemini_search",
  };
}

function normalizeParsed(
  parsed: z.infer<typeof venueContextSchema>,
): GeminiVenueContext {
  const countryCode = parsed.countryCode?.toUpperCase();
  const regionHint = parsed.regionHint ?? undefined;
  const emergencyNumber =
    parsed.emergencyNumber?.replace(/\D/g, "") ??
    (countryCode
      ? emergencyDisplayFromCountryCode(countryCode, regionHint)?.number
      : undefined);
  const emergencyRegion =
    (countryCode ? emergencyRegionFromCountryCode(countryCode) : undefined) ??
    emergencyRegionFromRegionHint(regionHint);

  return {
    placeQuery: parsed.placeQuery ?? undefined,
    countryCode,
    regionHint,
    emergencyNumber,
    emergencyRegion,
    source: "gemini_search",
  };
}

async function generateVenueContext(
  apiKey: string,
  model: string,
  prompt: string,
  useSearch: boolean,
): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens: 256,
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  return response.text?.trim();
}

/**
 * Server-only. Uses Gemini + Google Search grounding to find current venue/country.
 */
export async function resolveVenueContextWithGemini(options: {
  /** @deprecated Use `request` — only masked place/region hints are sent to Gemini. */
  chatSnippet?: string;
  placeHint?: string;
  /** Preferred: normalized venue lookup (PII masked, no raw chat). */
  request?: VenueLookupRequest;
}): Promise<GeminiVenueContext | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.GEMINI_MODEL_NAME?.trim() || "gemini-3.6-flash";
  const req: VenueLookupRequest = options.request ?? {
    placeHint: options.placeHint ?? "",
    chatSnippet: options.chatSnippet,
  };
  const grounding = venueGroundingText(req);
  if (!grounding.trim()) return null;

  const prompt = `You help emergency routing find the CURRENT real-world location of events and venues.

Location hints from the user (PII redacted; may include typos):
"""
${grounding}
"""

Always use Google Search to confirm where the person is NOW and the correct local emergency number for that country/territory.

Reply with ONLY one JSON object, no markdown:
{"placeQuery":"best Google Maps search string","countryCode":"ISO 3166-1 alpha-2","regionHint":"City, Country","emergencyNumber":"primary EMS digits only"}

Rules:
- placeQuery: e.g. "Goa, India", "Wonderfruit Festival", "Mexico City".
- countryCode: ISO two letters (MX, SG, BR, IN, US, etc.) — any country, not only common ones.
- emergencyNumber: the main number people dial for police/fire/ambulance there (e.g. 911, 112, 999, 119).
- If you cannot determine a field, omit it or use null.
- Do not include medical advice.`;

  try {
    let text =
      (await generateVenueContext(apiKey, model, prompt, true)) ??
      (await generateVenueContext(apiKey, model, prompt, false));

    if (!text) return null;

    try {
      const parsed = venueContextSchema.safeParse(parseJsonFromModel(text));
      if (parsed.success) return normalizeParsed(parsed.data);
    } catch {
      // fall through to loose parse
    }

    return looseParseFromText(text, grounding);
  } catch {
    return looseParseFromText("", grounding);
  }
}
