# AngeLifeline

**AngeLifeline** is an open-source **crisis overlay** for chat-style apps: when a message looks like an emergency, it takes over the screen and shows local emergency numbers (and optional venue lookup). It is **not** the AI model or the chat API—it sits on top of whatever UI already handles messages.

Packages and embed instructions live in this repository ([github.com/hktrippyart/AngeLifeline](https://github.com/hktrippyart/AngeLifeline)): `@angelifeline/core`, `@angelifeline/react`, and `@angelifeline/next` (npm when published, or clone for local dev).

Monorepo:

| Package | Use |
|---------|-----|
| `@angelifeline/core` | Routing, helplines, client fetch helpers, server resolvers |
| `@angelifeline/react` | `AngeLifelineOverlay` UI |
| `@angelifeline/next` | App Router `POST` handlers for venue + crisis APIs |

This repo’s Next.js app is a **live sandbox** (`npm run dev`).

---

## Embed in ~15 minutes (Next.js)

### 1. Install

From npm (when published) or a monorepo path:

```bash
npm install @angelifeline/core @angelifeline/react @angelifeline/next
```

Local monorepo link example:

```json
{
  "dependencies": {
    "@angelifeline/core": "file:../AngeLifeline/packages/core",
    "@angelifeline/react": "file:../AngeLifeline/packages/react",
    "@angelifeline/next": "file:../AngeLifeline/packages/next"
  }
}
```

### 2. Transpile packages

```ts
// next.config.ts
const nextConfig = {
  transpilePackages: [
    "@angelifeline/core",
    "@angelifeline/react",
    "@angelifeline/next",
  ],
};
```

### 3. Mount API routes

```ts
// app/api/angelifeline/venue-lookup/route.ts
export { POST } from "@angelifeline/next/venue-lookup";

// app/api/angelifeline/crisis-helplines/route.ts
export { POST } from "@angelifeline/next/crisis-helplines";

// app/api/angelifeline/crisis-triage/route.ts
export { POST } from "@angelifeline/next/crisis-triage";
```

### 4. Environment

```env
GEMINI_API_KEY=              # country/EMS + search grounding
GOOGLE_MAPS_API_KEY=         # optional Places (address/country only)
THROUGHLINE_CLIENT_ID=       # optional live suicide/crisis lines (OAuth)
THROUGHLINE_CLIENT_SECRET=
# Or: FINDAHELPLINE_CLIENT_ID / FINDAHELPLINE_CLIENT_SECRET
```


### 5a. Semantic crisis triage (recommended)

Keyword lists miss paraphrases. Mount the triage route and call it before opening the overlay (or use the same `resolveHardCrisis` on your chat API):

```ts
import { fetchCrisisTriage, resolveHardCrisis } from "@angelifeline/core";

// Client (needs POST route + GEMINI_API_KEY on server):
const triage = await fetchCrisisTriage({ lastUserText, chatSnippet });

// Server inside your chat handler:
const { hardCrisis, crisisFocus } = await resolveHardCrisis({ lastUserText, chatSnippet });
```

When `hardCrisis` is true, open `AngeLifelineOverlay` with `triggered` and `highSeverity` set.

### 5. Wire the overlay in chat

```tsx
"use client";

import { AngeLifelineOverlay } from "@angelifeline/react";
import {
  analyzeForRedFlag,
  classifyDeviceTelephony,
  fetchCrisisHelplines,
  resolveSecondaryLines,
  inferCrisisFocus,
  hasResolvablePlaceHint,
} from "@angelifeline/core";

// On red-flag: set analysis state, call resolveSecondaryLines({ chatSnippet })
// and fetchCrisisHelplines({ chatSnippet, crisisFocus, uiLocale, ... })
// Render <AngeLifelineOverlay uiLocale="en" analysis={...} ... />
```

Default client fetch paths:

- `/api/angelifeline/venue-lookup`
- `/api/angelifeline/crisis-helplines`

Override once on the client:

```ts
import { configureAngeLifelineApi } from "@angelifeline/core";

configureAngeLifelineApi({
  venueLookup: "/api/my-prefix/venue",
  crisisHelplines: "/api/my-prefix/crisis",
});
```


### 5b. User disclaimer (required for embedders)

Show scope **before chat** — not only when the overlay opens. Use copy from `@angelifeline/core` or the optional UI block:

```tsx
import { AngeLifelineEmbedDisclaimer } from "@angelifeline/react";
import { getAngeLifelineEmbedDisclaimer } from "@angelifeline/core";

// In your pre-chat modal:
<AngeLifelineEmbedDisclaimer uiLocale="en" />

// Or merge into your terms:
const { title, paragraphs, acknowledgeLabel } = getAngeLifelineEmbedDisclaimer("en");
```

See [docs/DISCLAIMER.md](./docs/DISCLAIMER.md).

### 6. Crisis chat copy (optional)

If your backend streams Gemini replies on hard crisis, inject the same numbers the overlay shows:

```ts
import { buildAngeLifelineNumbersBlockForChat } from "@angelifeline/core";

const block = await buildAngeLifelineNumbersBlockForChat({
  chatSnippet,
  uiLocale: "en",
});
// append `block` to the model system prompt or final user message
```

---

## Routing policy (what we ship)

- **EMS** from ISO country + search — always shown in overlay when policy requires (including suicide-without-place primary EMS).
- **Suicide / mixed** without GPS: 繁中 → HK+TW helplines + primary EMS; 简体 → China; ThroughLine when configured.
- **Places** for location context only — **no** front-desk POI `tel:` as “event lines.”
- **Venue lookup** runs Gemini search on each lifeline refresh when chat text exists (unless suicide-only with no place hint).

See [docs/DEPRECATED.md](./docs/DEPRECATED.md) for removed `venues.json` demo behavior.

---

## Develop this repo

```bash
cp .env.example .env.local   # add keys for live demo
npm install
npm run dev
```

Open `/` for the sandbox chat.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — issues and PRs welcome; run `npm run build` before submitting a PR.

## License

MIT — see [LICENSE](./LICENSE).
