# Deprecated (pre-0.2 demo)

The following shipped in early AngeLifeline demos and are **removed** in favor of `@angelifeline/core` policy:

| Removed | Replacement |
|---------|-------------|
| `src/data/venues.json` static venue phones | Gemini + Google Search + Places for **country/EMS** only |
| `src/lib/venue-routing.ts` | `resolveVenueForCrisis`, `resolveSecondaryLines` |
| Root `AngeLifelineOverlay.tsx` + `src/lib/*` copies | `@angelifeline/react` + `@angelifeline/core` |
| `docs/VENUE_ROUTING.md` (POI tel focus) | This README + package exports |

**Do not** use hotel/resort POI telephone numbers as “secondary lines.” Places may enrich address and ISO country; overlay filters `source === "places"` tel lines.
