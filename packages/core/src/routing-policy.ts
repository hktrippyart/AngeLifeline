import { normalizeVenueLookupRequest } from "./angelifeline-venue-privacy";

/** Lower index = higher priority when showing secondary lines. */
export const LINE_KIND_PRIORITY = [
  "event_medical",
  "security_control_room",
  "on_site_tonight",
  "front_desk",
] as const;

export type LineKind = (typeof LINE_KIND_PRIORITY)[number];

export type SecondaryLine = {
  kind: LineKind;
  labelEn: string;
  labelZh: string;
  tel: string;
  source: "curated" | "places";
};

export function lineKindRank(kind: LineKind): number {
  const i = LINE_KIND_PRIORITY.indexOf(kind);
  return i === -1 ? LINE_KIND_PRIORITY.length : i;
}

export function sortSecondaryLines(lines: SecondaryLine[]): SecondaryLine[] {
  return [...lines].sort(
    (a, b) => lineKindRank(a.kind) - lineKindRank(b.kind),
  );
}

/** Allowed JSON fields for third-party venue lookup — nothing else. */
export type VenueLookupRequest = {
  placeHint: string;
  regionHint?: string;
  /**
   * Legacy hosts may send this; AngeLifeline normalizes it away before Gemini.
   * Only a masked first-line fallback is used to derive placeHint if placeHint is empty.
   */
  chatSnippet?: string;
};

export function parseVenueLookupRequest(
  body: unknown,
): VenueLookupRequest | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const allowed = new Set(["placeHint", "regionHint", "chatSnippet"]);
  if (Object.keys(o).some((k) => !allowed.has(k))) return null;
  if (o.regionHint !== undefined && typeof o.regionHint !== "string") {
    return null;
  }
  if (o.chatSnippet !== undefined && typeof o.chatSnippet !== "string") {
    return null;
  }
  const chatSnippet =
    typeof o.chatSnippet === "string"
      ? o.chatSnippet.trim().slice(0, 500)
      : undefined;
  let placeHint =
    typeof o.placeHint === "string" ? o.placeHint.trim().slice(0, 120) : "";
  if (!placeHint && chatSnippet) {
    const line = chatSnippet
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.length >= 2);
    placeHint = (line ?? chatSnippet).slice(0, 120);
  }
  if (!placeHint) return null;
  return normalizeVenueLookupRequest({
    placeHint,
    regionHint:
      typeof o.regionHint === "string"
        ? o.regionHint.trim().slice(0, 80)
        : undefined,
    chatSnippet,
  });
}
