import { resolveHardCrisis } from "@angelifeline/core";
import { z } from "zod";

const bodySchema = z.object({
  lastUserText: z.string().min(1).max(8000),
  chatSnippet: z.string().max(4000),
});

/** Next.js App Router POST — mount at `/api/angelifeline/crisis-triage`. */
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

  const result = await resolveHardCrisis({
    lastUserText: parsed.data.lastUserText,
    chatSnippet: parsed.data.chatSnippet,
  });

  return Response.json(result);
}
