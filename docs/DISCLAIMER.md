# Disclaimers for embedders

AngeLifeline is **MIT software**, not a regulated emergency service. **You** (the host app) must set user expectations before chat and keep your own terms aligned with how you use the overlay.

## Two layers

| Layer | When | What to use |
|-------|------|-------------|
| **Embed scope** | Before first message (with your product disclaimer) | `getAngeLifelineEmbedDisclaimer(uiLocale)` or `<AngeLifelineEmbedDisclaimer uiLocale="en" />` from `@angelifeline/react` |
| **Overlay** | When a crisis overlay opens | Built into `AngeLifelineOverlay` (scope + accuracy footnote via `getAngeLifelineOverlayDisclaimer`) |

Do **not** market the host app or AngeLifeline as a replacement for EMS, a crisis hotline, or clinical care.

## Embed copy (summary)

The default embed text explains that:

- The overlay suggests numbers when crisis language is detected; it does not dispatch help.
- Numbers come from rules and optional Gemini / Search / Places / ThroughLine — they can be wrong or incomplete.
- There is **no GPS or IP geolocation**; place context comes from chat text (and optional host event config).
- Your chat/AI remains separate from the overlay.

Use `acknowledgeLabel` from `getAngeLifelineEmbedDisclaimer` for a consent checkbox, or merge those points into your existing “I agree” flow. AngeLifeline does not persist acceptance; hosts store that if required.

This document is product guidance, not legal advice.
