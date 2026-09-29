import { resolveVenueForCrisis } from "@angelifeline/core";
import {
  parseVenueLookupRequest,
  type SecondaryLine,
} from "@angelifeline/core";

function placesApiKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
}

/** Next.js App Router `POST` handler — re-export from your route file. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseVenueLookupRequest(body);
  if (!parsed) {
    return Response.json(
      {
        error: "invalid_body",
        detail:
          "Only { placeHint, regionHint?, chatSnippet? } allowed — no other fields.",
      },
      { status: 400 },
    );
  }

  const placesKey = placesApiKey();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());

  if (!placesKey && !geminiConfigured) {
    return Response.json({
      configured: false,
      lines: [] as SecondaryLine[],
    });
  }

  try {
    const result = await resolveVenueForCrisis(parsed, placesKey);
    return Response.json({
      configured: true,
      lines: result.line ? [result.line] : [],
      resolved: result.resolved,
      geminiUsed: result.geminiUsed,
    });
  } catch {
    return Response.json({ configured: true, lines: [] as SecondaryLine[] });
  }
}
