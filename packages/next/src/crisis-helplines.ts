import { resolveCrisisHelplines } from "@angelifeline/core";
import type { EmergencyRegion } from "@angelifeline/core";
import { z } from "zod";

const bodySchema = z.object({
  chatSnippet: z.string().max(4000),
  regionHint: z.string().max(80).optional(),
  emergencyRegion: z
    .enum(["hk", "jp", "th", "uk", "us_ca", "au", "eu", "in"])
    .optional(),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  crisisFocus: z
    .enum(["suicide", "medical", "mixed", "general"])
    .optional(),
  uiLocale: z.enum(["en", "zh-Hant"]).optional(),
});

/** Next.js App Router `POST` handler — re-export from your route file. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await resolveCrisisHelplines({
    chatSnippet: parsed.data.chatSnippet,
    regionHint: parsed.data.regionHint,
    emergencyRegion: parsed.data.emergencyRegion as EmergencyRegion | undefined,
    countryCode: parsed.data.countryCode?.toUpperCase(),
    crisisFocus: parsed.data.crisisFocus,
    uiLocale: parsed.data.uiLocale,
  });

  return Response.json(result);
}
