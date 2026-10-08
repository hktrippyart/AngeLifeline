export type AngeLifelineApiPaths = {
  venueLookup: string;
  crisisHelplines: string;
  crisisTriage: string;
  judge: string;
};

const DEFAULT_PATHS: AngeLifelineApiPaths = {
  venueLookup: "/api/angelifeline/venue-lookup",
  crisisHelplines: "/api/angelifeline/crisis-helplines",
  crisisTriage: "/api/angelifeline/crisis-triage",
  judge: "/api/angelifeline/judge",
};

let paths: AngeLifelineApiPaths = { ...DEFAULT_PATHS };

/** Host apps can mount routes under a custom prefix. Call once on the client before fetches. */
export function configureAngeLifelineApi(
  partial: Partial<AngeLifelineApiPaths>,
): void {
  paths = { ...paths, ...partial };
}

export function getAngeLifelineApiPaths(): AngeLifelineApiPaths {
  return paths;
}
