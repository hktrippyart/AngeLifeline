import { maskPII } from "./angelifeline-mask";
import type { VenueLookupRequest } from "./routing-policy";

/**
 * Server + client: redact PII and drop full chat before venue / Gemini lookup.
 * Gemini and Places only receive placeHint (+ optional regionHint), never chatSnippet.
 */
export function normalizeVenueLookupRequest(
  raw: VenueLookupRequest,
): VenueLookupRequest {
  let placeHint = maskPII(raw.placeHint ?? "").text.trim().slice(0, 120);
  const regionHint = raw.regionHint
    ? maskPII(raw.regionHint).text.trim().slice(0, 80)
    : undefined;

  if (!placeHint && raw.chatSnippet?.trim()) {
    const masked = maskPII(raw.chatSnippet).text;
    const line = masked
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.length >= 2);
    placeHint = (line ?? masked).trim().slice(0, 120);
  }

  return {
    placeHint,
    ...(regionHint ? { regionHint } : {}),
  };
}

/** Minimal string for Gemini venue grounding (masked hints only). */
export function venueGroundingText(req: VenueLookupRequest): string {
  const normalized = normalizeVenueLookupRequest(req);
  if (!normalized.placeHint) return "";
  return normalized.regionHint
    ? `${normalized.placeHint}; ${normalized.regionHint}`
    : normalized.placeHint;
}
