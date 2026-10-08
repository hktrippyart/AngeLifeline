import { maskPII, type MaskCounts } from "./angelifeline-mask";

const MAX_JSON_BYTES = 32_000;

type Bucket = { count: number; windowStart: number };

const rateBuckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "anonymous";
}

/** In-memory limiter; serverless instances each keep their own bucket (defense in depth only). */
export function allow(key: string): boolean {
  if (!process.env.RATE_LIMIT_SECRET?.trim()) return true;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

export async function readLimitedJson(req: Request): Promise<Record<string, unknown>> {
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_JSON_BYTES) throw new Error("bad_input");
  const text = new TextDecoder().decode(buf).trim();
  if (!text) throw new Error("bad_input");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("bad_input");
  }
  return parsed as Record<string, unknown>;
}

/** Server-side second pass over client-masked text. */
export function sanitize(input: unknown): {
  text: string;
  counts: MaskCounts;
  truncated: boolean;
} {
  const raw = typeof input === "string" ? input : "";
  return maskPII(raw);
}

export function errorCode(e: unknown): string {
  if (e instanceof Error && e.message) return e.message.slice(0, 48);
  return "error";
}

export function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ source: "angelifeline", ...payload }));
}
