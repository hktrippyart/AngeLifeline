import { GoogleGenAI } from "@google/genai";
import { JUDGE_SYSTEM_PROMPT } from "./angelifeline-judge-prompt";
import {
  allow,
  clientKey,
  errorCode,
  logEvent,
  readLimitedJson,
  sanitize,
} from "./angelifeline-backend-privacy";
import { parseVerdict, type Verdict } from "./angelifeline-pipeline";

export type JudgeServerResult =
  | { status: "ok"; verdict: Verdict; ms: number }
  | { status: "timeout" | "error" | "invalid" | "blocked"; ms: number };

/**
 * Server-only Gemini judge on already-masked text (temperature 0, JSON verdict).
 */
export async function judgeMaskedText(
  maskedText: string,
  options: { timeoutMs?: number } = {},
): Promise<JudgeServerResult> {
  const t0 = Date.now();
  const text = maskedText.trim();
  if (!text) return { status: "blocked", ms: 0 };

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { status: "error", ms: Date.now() - t0 };

  const model =
    process.env.GEMINI_JUDGE_MODEL?.trim() ||
    process.env.GEMINI_MODEL_NAME?.trim() ||
    "gemini-2.5-flash";
  const timeoutMs = options.timeoutMs ?? Number(process.env.JUDGE_TIMEOUT_MS ?? 2500);

  const TIMEOUT = Symbol("timeout");
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const call = ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: `<message>\n${text}\n</message>` }],
        },
      ],
      config: {
        systemInstruction: JUDGE_SYSTEM_PROMPT,
        temperature: 0,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    });
    const timeout = new Promise<typeof TIMEOUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
    });
    const raced = await Promise.race([call, timeout]);
    const ms = Date.now() - t0;
    if (raced === TIMEOUT) return { status: "timeout", ms };
    const raw = raced.text?.trim() ?? "";
    if (!raw) return { status: "blocked", ms };
    const verdict = parseVerdict(raw);
    return verdict ? { status: "ok", verdict, ms } : { status: "invalid", ms };
  } catch {
    return { status: "error", ms: Date.now() - t0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Next.js App Router handler for POST /api/angelifeline/judge */
export async function handleJudgePost(req: Request): Promise<Response> {
  const t0 = Date.now();
  const route = "judge";
  try {
    if (!allow(clientKey(req))) {
      logEvent({ route, status: 429, ms: Date.now() - t0, rateLimited: true, degraded: true });
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await readLimitedJson(req);
    const { text, counts, truncated } = sanitize(body.text);
    if (!text.trim()) throw new Error("bad_input");

    const result = await judgeMaskedText(text);
    if (result.status === "ok") {
      logEvent({ route, status: 200, ms: Date.now() - t0, redacted: counts, truncated });
      return Response.json({
        level: result.verdict.level,
        category: result.verdict.category,
      });
    }
    if (result.status === "blocked") {
      logEvent({ route, status: 200, ms: Date.now() - t0, redacted: counts, truncated, degraded: true });
      return Response.json({ blocked: true });
    }
    throw new Error(`llm_${result.status}`);
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    const code = timedOut ? "llm_timeout" : errorCode(e);
    logEvent({ route, status: 502, ms: Date.now() - t0, error: code, degraded: true });
    return Response.json({ error: code }, { status: 502 });
  }
}
