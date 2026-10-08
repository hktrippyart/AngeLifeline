# AngeLifeline

**AngeLifeline** is an open-source **crisis overlay** for chat-style apps: when a message looks like an emergency, it takes over the screen and shows local emergency numbers (and optional venue lookup). It is **not** the AI model or the chat API—it sits on top of whatever UI already handles messages.

Packages and embed instructions live in this repository ([github.com/hktrippyart/AngeLifeline](https://github.com/hktrippyart/AngeLifeline)): `@angelifeline/core`, `@angelifeline/react`, and `@angelifeline/next` (npm when published, or clone for local dev).

Monorepo:

| Package | Use |
|---------|-----|
| `@angelifeline/core` | Rules engine, crisis pipeline, PII mask, judge server, routing, helplines |
| `@angelifeline/react` | `AngeLifelineOverlay` UI |
| `@angelifeline/next` | App Router `POST` handlers for venue + crisis APIs |

This repo’s Next.js app is a **live sandbox** (`npm run dev`).

---

## Crisis detection (how it works)

Detection is **layered**. Design goals: **never miss obvious literal crisis wording**, **do not send raw PII to the LLM**, and **never show an empty overlay** if the model fails.

| Step | Where | What |
|------|--------|------|
| **1. Rules (raw text)** | Browser or server | `detectRules()` on the **original** user message. **`high`** (e.g. explicit self-harm, violence, or medical emergency wording in English, Chinese, or mixed input) → open overlay **immediately**—no LLM, no network. |
| **2. PII mask** | Browser, then server again | `maskPII()` strips common identifiers (email, HK/CN ID patterns, Luhn-valid cards, long phone numbers). Short codes like **999** / **112** are not masked. |
| **3. LLM judge** | Server only | `POST /api/angelifeline/judge` receives **already masked** text, masks again, calls Gemini with a fixed JSON schema (`urgent` / `concern` / `none`). Temperature **0**, server timeout ~**2.5s** (client race ~**3s**). |
| **4. Merge** | `processMessage()` or `resolveHardCrisis()` | **Overlay**: rule `high`, judge `urgent`, or rule `review` + judge `concern` (configurable). **Soft prompt**: judge `concern` without escalation. |
| **5. Fail-safe** | Same | Judge timeout, error, block, or invalid JSON → treat as unavailable; **review** rules still escalate; **static EMS table** always fills the overlay (AI lookup never replaces primary emergency digits). |

**Important:** Rule **`high`** cannot be overridden by the LLM (the judge is not called on that path).

### Recommended client flow

Use the **pipeline** in the browser so steps 1–5 and location follow-up stay in one place:

```ts
import {
  createSession,
  processMessage,
  createHttpJudge,
  createHttpLookup,
} from "@angelifeline/core/angelifeline-pipeline";
import { detectRules } from "@angelifeline/core/angelifeline-rules";
import { maskPII } from "@angelifeline/core/angelifeline-mask";
import { configureAngeLifelineApi } from "@angelifeline/core";

configureAngeLifelineApi({
  judge: "/api/angelifeline/judge",
  venueLookup: "/api/angelifeline/venue-lookup",
});

const session = createSession();

const { action, followUp, debug } = await processMessage(session, userText, {
  detectRules,
  maskPII,
  judge: createHttpJudge("/api/angelifeline/judge"),
  lookup: createHttpLookup("/api/angelifeline/venue-lookup"),
  env: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  },
  config: {
    siteRegion: "HK",
    judgeTimeoutMs: 3000,
    knownEvents: [{ name: "Clockenflap Festival", region: "HK" }],
  },
});

// action.type: "overlay" | "overlay_update" | "soft_prompt" | "none"
// followUp: optional Promise when venue/event lookup finishes in the background
```

`debug` intentionally **does not** include user message text (only rule ids, judge status, region guess).

### Server-only gate (chat API / triage route)

If you prefer one server round-trip instead of the browser judge:

```ts
import { resolveHardCrisis } from "@angelifeline/core/resolve-hard-crisis";

const { hardCrisis, softPrompt, crisisFocus, rulesMatch, geminiEscalate } =
  await resolveHardCrisis({ lastUserText, chatSnippet });
```

Same merge logic as the pipeline: rules first, then masked judge on the server.

Legacy **`fetchCrisisTriage`** → `POST /api/angelifeline/crisis-triage` still works and uses `resolveHardCrisis`.

### Emergency numbers vs AI search

- **Primary EMS** comes from a **static, hand-verifiable table** in `angelifeline-pipeline.ts` (`EMS`, plus universal **112** note). Set `EMS_LAST_VERIFIED` after you audit numbers.
- **Region guess** when the user has not named a place: timezone → browser locale → `detectLang()` on the message → `siteRegion`.
- **Known place / event** in text → higher confidence region; optional **venue lookup** sends **only the place hint** (not the full chat) to your existing venue route. AI-returned numbers are **extras** with “verify” framing—they **do not** replace static EMS.
- After an overlay opens **without** a known place, the pipeline **watches the next few user messages** for location hints and can emit `overlay_update`.

### PII masking limits

Document honestly: masking catches **formatted** identifiers, not names, addresses, or free-text medical detail. Say “common identifiers removed,” not “fully anonymous.” See `angelifeline-mask.ts`.

### Judge prompt

System prompt lives in `angelifeline-judge-prompt.ts` (`JUDGE_PROMPT_VERSION`). Keep it in sync with any offline eval notebook before changing behavior.

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

Submodule example (trip-sitter): see host repo `docs/ANGELIFELINE_SUBMODULE.md`.

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

Hosts using TypeScript path aliases to `vendor/AngeLifeline/packages/core/src/*` should **exclude** `vendor/**/*.test.ts` from the app typecheck.

### 3. Mount API routes

```ts
// app/api/angelifeline/venue-lookup/route.ts
export { POST } from "@angelifeline/next/venue-lookup";

// app/api/angelifeline/crisis-helplines/route.ts
export { POST } from "@angelifeline/next/crisis-helplines";

// app/api/angelifeline/crisis-triage/route.ts
export { POST } from "@angelifeline/next/crisis-triage";

// app/api/angelifeline/judge/route.ts — LLM triage on masked text only
import { handleJudgePost } from "@angelifeline/core/angelifeline-judge-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleJudgePost(request);
}
```

### 4. Environment

```env
GEMINI_API_KEY=              # judge + venue search grounding (server only)
GEMINI_JUDGE_MODEL=          # optional; default gemini-2.5-flash (pin a version in prod)
GEMINI_MODEL_NAME=           # fallback model id if JUDGE_MODEL unset
JUDGE_TIMEOUT_MS=2500        # server; keep below client pipeline timeout (~3000)
RATE_LIMIT_SECRET=           # optional; enables per-IP rate limit on /judge

GOOGLE_MAPS_API_KEY=         # optional Places (address/country only)
THROUGHLINE_CLIENT_ID=       # optional live suicide/crisis lines (OAuth)
THROUGHLINE_CLIENT_SECRET=
# Or: FINDAHELPLINE_CLIENT_ID / FINDAHELPLINE_CLIENT_SECRET
```

Without `GEMINI_API_KEY`, the judge fails closed into **rules-only** behavior (literal **high** rules and **review** fail-safe still work).

### 5. Wire the overlay in chat

On `action.type === "overlay"`, open `AngeLifelineOverlay` with `triggered` and `highSeverity`. Map pipeline `categories` to your `crisisFocus` (`self_harm` → suicide, etc.). On `soft_prompt`, show a gentle in-chat nudge (no full overlay).

```tsx
"use client";

import { AngeLifelineOverlay } from "@angelifeline/react";
import {
  analyzeForRedFlag,
  classifyDeviceTelephony,
  fetchCrisisHelplines,
  resolveSecondaryLines,
} from "@angelifeline/core";
// + processMessage / createHttpJudge as above
```

Default client API paths (override with `configureAngeLifelineApi`):

| Path | Purpose |
|------|---------|
| `/api/angelifeline/judge` | Masked LLM verdict |
| `/api/angelifeline/venue-lookup` | Place/event hint → secondary lines |
| `/api/angelifeline/crisis-helplines` | Suicide/crisis talk lines |
| `/api/angelifeline/crisis-triage` | Server `resolveHardCrisis` JSON |

### 5b. User disclaimer (required for embedders)

Show scope **before chat** — not only when the overlay opens. Use copy from `@angelifeline/core` or the optional UI block:

```tsx
import { AngeLifelineEmbedDisclaimer } from "@angelifeline/react";
import { getAngeLifelineEmbedDisclaimer } from "@angelifeline/core";
```

See [docs/DISCLAIMER.md](./docs/DISCLAIMER.md).

### 6. Crisis chat copy (optional)

If your backend streams Gemini replies on hard crisis, inject the same numbers the overlay shows:

```ts
import { buildAngeLifelineNumbersBlockForChat } from "@angelifeline/core";
```

---

## Core modules (reference)

| Module | Role |
|--------|------|
| `angelifeline-rules.ts` | Multilingual rule engine (`high` / `review`) |
| `angelifeline-mask.ts` | Client/server PII redaction |
| `angelifeline-pipeline.ts` | Browser orchestration, static EMS, place hints, session |
| `angelifeline-judge-prompt.ts` | Classifier system prompt |
| `angelifeline-judge-server.ts` | Gemini judge + `handleJudgePost` |
| `resolve-hard-crisis.ts` | Server merge (rules + judge) |

Tests (Node 22.6+):

```bash
cd packages/core && npm test
# angelfeline-rules.test.ts + angelfeline-pipeline.test.ts
```

---

## Routing policy (what we ship)

- **EMS** from static pipeline table + inference policy; host apps may layer ISO country + ThroughLine as in earlier integrations.
- **Suicide / mixed** without GPS: host-specific helpline policy (locale, country inference, ThroughLine when configured).
- **Places** for location context only — **no** front-desk POI `tel:` as “event lines.”
- **Venue lookup** may use Gemini search on **place hints**; full chat is not required for the pipeline lookup adapter.

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

See [CONTRIBUTING.md](./CONTRIBUTING.md) — issues and PRs welcome; run `npm run build` and `cd packages/core && npm test` before submitting a PR.

## License

MIT — see [LICENSE](./LICENSE).
