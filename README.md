# AngeLifeline

**AngeLifeline** is an open-source **crisis overlay** for chat-style apps: when a message looks like an emergency, it takes over the screen and shows local emergency numbers (and optional venue lookup). It is **not** the AI model or the chat API—it sits on top of whatever UI already handles messages.

It is also **model-agnostic**. The classifier (the “judge”) is a function you inject, so it can be the chat model you already run, a separate small model, or nothing at all. What AngeLifeline owns is the deterministic half: the rules, the merge policy, the timeout and fail-safe behaviour, and the static emergency-number table. Judge accuracy is yours—see [Judge contract](#judge-contract-bring-your-own-model).

Packages and embed instructions live in this repository ([github.com/hktrippyart/AngeLifeline](https://github.com/hktrippyart/AngeLifeline)): `@angelifeline/core`, `@angelifeline/react`, and `@angelifeline/next` (npm when published, or clone for local dev).

Monorepo:

| Package | Use |
|---------|-----|
| `@angelifeline/core` | Rules engine, crisis pipeline, PII mask, routing, helplines — plus an **optional** reference judge |
| `@angelifeline/react` | `AngeLifelineOverlay` UI |
| `@angelifeline/next` | App Router `POST` handlers for venue + crisis APIs |

This repo’s Next.js app is a **live sandbox** (`npm run dev`).

---

## Crisis detection (how it works)

Detection is **layered**. Design goals: **never miss obvious literal crisis wording**, **do not send raw PII to the judge**, and **never show an empty overlay** if the model fails.

| Step | Where | What |
|------|--------|------|
| **1. Rules (raw text)** | Browser or server | `detectRules()` on the **original** user message. **`high`** (e.g. explicit self-harm, violence, or medical emergency wording in English, Chinese, or mixed input) → open overlay **immediately**—no LLM, no network. |
| **2. PII mask** | Browser, then server again | `maskPII()` strips common identifiers (email, HK/CN ID patterns, Luhn-valid cards, long phone numbers). Short codes like **999** / **112** are not masked. |
| **3. Judge (any model)** | Your endpoint | The `Judge` you inject receives **already masked** text and returns `urgent` / `concern` / `none`. Model, prompt, and hosting are yours. AngeLifeline enforces only the timeout race (client ~**3s**) and strict parsing. The optional **reference judge** (`POST /api/angelifeline/judge`, temperature **0**, ~**2.5s**) is one implementation you can use as-is or replace. |
| **4. Merge** | `processMessage()` or `resolveHardCrisis()` | **Overlay**: rule `high`, judge `urgent`, or rule `review` + judge `concern` (configurable). **Soft prompt**: judge `concern` without escalation. |
| **4b. Cross-message** | `processMessage()` only | A single `concern` is only a soft prompt, but **two `concern` verdicts within `concernWindowMessages`** open the overlay (`reason: "repeat_llm_concern"`). Uses only message indices held in the in-memory `Session` — **no extra text is sent anywhere**. A judge `none` is not banked: the model saw the context and cleared it. |
| **5. Fail-safe** | Same | Judge timeout, error, block, or invalid JSON → treat as unavailable; **review** rules still escalate; **static EMS table** always fills the overlay (AI lookup never replaces primary emergency digits). |

### Rule levels

`detectRules()` returns one of three results, and each is handled differently:

| Result | Judge | Overlay |
|--------|-------|---------|
| **`high`** — literal, unambiguous wording: explicit suicidal intent, a suicide note, weapon threats, not breathing, unresponsive, seizure, choking, overdose (English and Chinese equivalents) | **Not called** | Opens **immediately**, before any network call |
| **`review`** — plausible but context-dependent: `can't breathe`, `collapsed`, `kms`, cramp, or Chinese phrasing that is usually exhaustion rather than intent | Called | Judge `urgent`/`concern` → overlay; judge `none` → nothing; judge unavailable → overlay (fail-safe) |
| no match | Called | Only judge `urgent` opens the overlay; `concern` is a soft prompt |

**Guarantee:** rule `high` opens the overlay with **zero latency and no network call**, and **no model can downgrade it**—the judge is never consulted on that path. Guards do the opposite where idioms are involved: `kill myself laughing`, `dying of embarrassment`, the Cantonese phrase that reads literally as “want to die” but means “I miss you”, and news-style discussion of suicide rates are all demoted to `review` by the rules themselves.

### Judge contract (bring your own model)

```ts
type Judge = (maskedText: string, signal: AbortSignal) => Promise<unknown>;
```

Wire anything: your chat model, a dedicated classifier, a hosted API, or a local model. `createHttpJudge(url)` is just a convenience adapter to your own endpoint, and `judge` is **optional**—omit it and the pipeline runs rules-only.

Your judge should:

- return `{ level, category }` (or a JSON string containing it) where `level` is `"urgent" | "concern" | "none"`;
- return `null` or `""` when the model refuses or returns nothing (treated as **blocked**);
- throw on transport errors, and honour the `AbortSignal`.

AngeLifeline then guarantees, independent of your model: the timeout race, strict parsing (anything unparseable counts as unavailable, never as `none`), the fail-safe escalation of `review` rules, and a non-empty EMS card.

**AngeLifeline makes no accuracy claim about your judge.** Precision and recall depend entirely on the model and prompt you choose. To measure what you are actually getting, run your judge against `MUST_HIGH` / `MUST_NOT_HIGH` in `packages/core/src/angelifeline-rules.test.ts`—about 90 labelled Cantonese, Chinese, and English messages, including the hyperbole cases that cause most false positives.

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
    repeatConcernEscalates: true, // two `concern` turns in a row open the overlay
    concernWindowMessages: 3,
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

- **Primary EMS** comes from a **static ISO 3166-1 table** (`EMS` in `angelifeline-pipeline.ts`, built from `data/emergency-numbers-wiki.json` plus hand overrides in `angelifeline-ems-iso.ts`), with a universal **112** note. Set `EMS_LAST_VERIFIED` after you audit high-traffic regions.
- **Region guess** when the user has not named a place: timezone → browser locale → `detectLang()` on the message → `siteRegion`.
- **Known place / event** in text → higher confidence region; optional **venue lookup** sends **only the place hint** (not the full chat) to your existing venue route. AI-returned numbers are **extras** with “verify” framing—they **do not** replace static EMS.
- After an overlay opens **without** a known place, the pipeline **watches the next few user messages** for location hints and can emit `overlay_update`.

### Detection limits

State these plainly to anyone who embeds this:

- **Rules ship for English and Chinese only** (Cantonese colloquial, Traditional, and Simplified via normalisation). For any other language `detectRules()` returns `none`, so there is **no zero-latency, deterministic trigger**—detection falls entirely to the judge you inject. The fail-safe still works, but it can only fire on wording the rules recognise.
- **Rules are pattern-based.** Indirect, metaphorical, or deliberately obfuscated wording is missed, and spaced-out spellings (`k i l l`) are not handled. The test corpus defines current behaviour; treat anything outside it as unverified.

### PII masking limits

Document honestly: masking catches **formatted** identifiers, not names, addresses, or free-text medical detail. Say “common identifiers removed,” not “fully anonymous.” Hong Kong IDs are only recognised without spaces or with a bracketed check digit, and non-HK/CN formats (for example Singapore NRIC) are out of scope. See `angelifeline-mask.ts`.

### Judge prompt

A judge needs instructions telling the model how to classify. The reference judge ships those in `angelifeline-judge-prompt.ts`: how to pick `urgent` / `concern` / `none`, which Cantonese and English exaggerations to treat as harmless, and a rule never to obey instructions written inside a user message.

You only need this file if you use the reference judge. **Bringing your own model means bringing your own prompt** — AngeLifeline only requires the `level` / `category` output shape, so the shipped prompt is a useful starting point, not a requirement.

If you do edit the prompt, bump `JUDGE_PROMPT_VERSION` and re-measure. Any accuracy numbers you collected describe the old prompt, not the new one.

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

// app/api/angelifeline/judge/route.ts — optional; only if you want the reference
// judge instead of pointing createHttpJudge at your own model endpoint
import { handleJudgePost } from "@angelifeline/core/angelifeline-judge-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleJudgePost(request);
}
```

### 4. Environment

Every key below is optional. The `GEMINI_*` keys are the credentials of the **reference judge** and the venue lookup, which currently call Google's Gemini API — a host that plugs in its own model does not need any of them, and would use that provider's own key instead.

```env
GEMINI_API_KEY=              # reference judge + venue search grounding (server only)
GEMINI_JUDGE_MODEL=          # optional; default gemini-2.5-flash (pin a version in prod)
GEMINI_MODEL_NAME=           # fallback model id if JUDGE_MODEL unset
JUDGE_TIMEOUT_MS=2500        # server; keep below client pipeline timeout (~3000)
RATE_LIMIT_SECRET=           # optional; enables per-IP rate limit on /judge

GOOGLE_MAPS_API_KEY=         # optional Places (address/country only)
THROUGHLINE_CLIENT_ID=       # optional live suicide/crisis lines (OAuth)
THROUGHLINE_CLIENT_SECRET=
# Or: FINDAHELPLINE_CLIENT_ID / FINDAHELPLINE_CLIENT_SECRET
```

With no key, the reference judge does **not** report “no crisis” — it reports itself as unavailable, which is the safe direction. The pipeline then falls back to rules only: literal `high` wording still opens the overlay instantly, and `review` wording also opens it because the judge cannot be consulted.

### 5. Wire the overlay in chat

On `action.type === "overlay"`, open `AngeLifelineOverlay` with `triggered` and `highSeverity`. Map pipeline `categories` to your `crisisFocus` (`self_harm` → suicide, etc.). On `soft_prompt`, show a gentle in-chat nudge (no full overlay).

#### One overlay per user message (client pipeline + server chat)

Many hosts run **both**:

1. **Client** — `processMessage()` (rules / judge) opens the overlay as soon as the user sends.
2. **Server** — the chat handler calls `resolveHardCrisis()` and may emit a stream event such as `{ crisis: true }` before the assistant reply tokens.

That is **two independent gates on the same turn**, not a second user message. If you do not dedupe, users can see the overlay open twice (often once before helplines load, again when the stream starts).

**Recommended:** keep a **per-turn flag** in your chat UI (e.g. a ref reset when the user sends, set when the overlay opens):

- When **`processMessage`** yields `action.type === "overlay"`, open the overlay and set the flag **`true`**.
- When handling **SSE / stream `crisis`** (or a second call to `fetchCrisisTriage`), **skip opening** if the flag is already `true` for this turn.
- Optional: if you only use the client pipeline for overlay timing, you can omit `{ crisis: true }` from the chat stream and rely on the pipeline alone — but then non-pipeline hosts must still use server triage.

Helplines and venue data may **update the same overlay** after the first open (numbers appear when `fetchCrisisHelplines` returns). That is a content refresh, not a second trigger.

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
| `angelifeline-judge-server.ts` | Reference judge (Gemini) + `handleJudgePost` |
| `resolve-hard-crisis.ts` | Server merge (rules + judge) |

Tests (Node 22.15+ / 24; run in CI on both):

```bash
cd packages/core && npm test
# angelifeline-rules.test.ts + angelifeline-pipeline.test.ts + angelifeline-mask.test.ts
```

No `npm install` needed — the tests only use Node builtins and local source. `scripts/node-ts-resolve.mjs` is a dependency-free resolve hook so `node --test` can run the TypeScript source with the extensionless imports that bundlers expect.

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
