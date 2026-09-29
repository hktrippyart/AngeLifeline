import type { CrisisHelplineLine } from "./crisis-helpline-types";

const TOKEN_URL = "https://api.findahelpline.com/oauth/token";
const HELPLINES_URL = "https://api.findahelpline.com/api/v1/helplines";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

type ThroughlineHelpline = {
  name?: string;
  phoneNumber?: string;
  smsNumber?: string;
  webChatUrl?: string;
  shortDescription?: string;
};

type HelplinesResponse = {
  helplines?: ThroughlineHelpline[];
};

function throughlineCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId =
    process.env.THROUGHLINE_CLIENT_ID?.trim() ||
    process.env.FINDAHELPLINE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.THROUGHLINE_CLIENT_SECRET?.trim() ||
    process.env.FINDAHELPLINE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string | null> {
  const creds = throughlineCredentials();
  if (!creds) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresIn * 1000,
  };
  return data.access_token;
}

function mapHelpline(entry: ThroughlineHelpline): CrisisHelplineLine | null {
  const name = entry.name?.trim();
  if (!name) return null;
  const tel = entry.phoneNumber?.trim().replace(/\s/g, "");
  const sms = entry.smsNumber?.trim();
  if (!tel && !sms && !entry.webChatUrl) return null;

  return {
    name,
    labelEn: name,
    labelZh: name,
    tel: tel || undefined,
    sms: sms || undefined,
    webChatUrl: entry.webChatUrl?.trim() || undefined,
    source: "throughline",
  };
}

/** Server-only: Find A Helpline / ThroughLine dataset for suicidal-thoughts topic. */
export async function fetchThroughlineSuicideHelplines(
  countryCode: string,
): Promise<CrisisHelplineLine[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const params = new URLSearchParams({
    country_code: countryCode.toLowerCase(),
    topic: "suicidal-thoughts",
    priority_only: "true",
  });

  const res = await fetch(`${HELPLINES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as HelplinesResponse;
  const lines: CrisisHelplineLine[] = [];
  for (const entry of data.helplines ?? []) {
    const mapped = mapHelpline(entry);
    if (mapped) lines.push(mapped);
  }
  return lines.slice(0, 4);
}

export function throughlineConfigured(): boolean {
  return throughlineCredentials() !== null;
}
