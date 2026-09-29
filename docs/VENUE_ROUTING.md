# Venue routing policy

> **Note:** The old `venues.json` demo is removed in v0.2. Production behavior lives in `@angelifeline/core` (Gemini/search + country EMS, no POI resort phones). See [DEPRECATED.md](./DEPRECATED.md) and the root [README](../README.md).

AngeLifeline routing is **privacy-first** and **emergency-first**.

## Priority stack (always)

1. **National lifeline (primary UI)** — curated only (e.g. HK **999**, US/CA **911**, EU **112**). Always shown first. Never replaced by lookup results.
2. **No GPS** — we do not read device location.
3. **No IP geolocation for routing** — VPNs make IP unreliable; do not choose 999 vs 911 from IP alone.
4. **Region / country hints** — from **chat content** (e.g. “Hong Kong”, “Kowloon”), **event config**, or **locale the user chose** — not from silent IP inference.

## Secondary lines (below emergency)

Sources are applied in order:

| Order | Source | Typical use |
|------|--------|-------------|
| A | **Curated event / venue list** (`venues.json`, per-event overrides) | Tonight’s medical, security, on-site lines you vouch for |
| B | **Live Google Maps / Places lookup** (server-only) | Fill gaps when chat mentions a place name not in your list |

### Line kind preference (when multiple numbers exist)

When ranking or choosing what to show under 999/911:

1. **Event medical**
2. **Security / control room**
3. **Tonight’s on-site line** (organizer-supplied)
4. **Customer service / front desk** — lowest priority; for the user to call themselves if nothing else fits

Curated entries should set `kind` explicitly. Places API results default to **front_desk** unless overridden by curated data for the same event.

## Third-party lookup (Google / Maps)

- **Server-only** — API keys never ship to the browser.
- **Request body is minimal** — only `{ placeHint, regionHint? }` derived from chat (place names / areas). **No** full transcript, distress narrative, user id, or chat history sent to Google.
- **User-visible content only** — hints are things the user already typed (e.g. “W Hotel”, “Clockenflap”); nothing private beyond that.
- Lookup is **secondary**; failure or ambiguity → user still has **999/911**.

## Demo vs production

- **Static HTML demo** — curated keywords only (no API call).
- **Next app** — curated + optional `POST /api/venue-lookup` when `GOOGLE_MAPS_API_KEY` is set.

## Organizer responsibility

Publish accurate **event medical / security** numbers in curated data for each night. Do not rely on Maps alone for safety-critical lines.
