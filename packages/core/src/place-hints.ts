import { LIVE_SEARCH_EVENTS } from "./festival-places";
import { PLACE_KEYWORD_ENTRIES } from "./place-keywords";

const REGION_HINTS = [
  "hong kong",
  "hk",
  "kowloon",
  "香港",
  "九龍",
  "central",
  "中環",
];

/** Place / area strings from chat — not sent as full message to third parties. */
export function extractPlaceHints(text: string): string[] {
  const hints = new Set<string>();
  const lower = text.toLowerCase();

  for (const entry of PLACE_KEYWORD_ENTRIES) {
    if (
      entry.keywords.some(
        (kw) => lower.includes(kw.toLowerCase()) || text.includes(kw),
      )
    ) {
      hints.add(entry.placeHint);
    }
  }

  for (const event of LIVE_SEARCH_EVENTS) {
    if (event.keywords.some((kw) => lower.includes(kw))) {
      hints.add(event.placeHint);
    }
  }

  for (const r of REGION_HINTS) {
    if (lower.includes(r) || text.includes(r)) {
      hints.add(r);
    }
  }

  const atMatch = text.match(/\b(?:at|@|near|in|喺|在)\s+([^,.!?]{2,40})/i);
  if (atMatch?.[1]) {
    hints.add(atMatch[1].trim());
  }

  return [...hints].slice(0, 3);
}

export function extractRegionHint(text: string): string | undefined {
  return extractExplicitRegionHint(text);
}

/** Country/area from chat — not from festival nickname defaults. */
export function extractExplicitRegionHint(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (
    lower.includes("hong kong") ||
    lower.includes(" kowloon") ||
    text.includes("香港")
  ) {
    return "Hong Kong";
  }
  if (
    lower.includes("japan") ||
    lower.includes("osaka") ||
    lower.includes("tokyo") ||
    text.includes("日本") ||
    text.includes("大阪") ||
    text.includes("東京")
  ) {
    return "Japan";
  }
  if (
    lower.includes("thailand") ||
    lower.includes("pattaya") ||
    lower.includes("bangkok") ||
    text.includes("泰国") ||
    text.includes("泰國")
  ) {
    return "Thailand";
  }
  if (lower.includes("hungary") || lower.includes("budapest")) {
    return "Hungary";
  }
  if (
    lower.includes("india") ||
    lower.includes("goa") ||
    lower.includes("mumbai") ||
    lower.includes("delhi") ||
    text.includes("印度")
  ) {
    return "India";
  }
  if (
    lower.includes("taiwan") ||
    lower.includes("tainan") ||
    lower.includes("taipei") ||
    text.includes("台灣") ||
    text.includes("台湾") ||
    text.includes("台南") ||
    text.includes("臺南")
  ) {
    return "Taiwan";
  }
  if (
    lower.includes("united states") ||
    lower.includes(" nevada") ||
    lower.includes("usa") ||
    lower.includes("america")
  ) {
    return "United States";
  }
  return undefined;
}
