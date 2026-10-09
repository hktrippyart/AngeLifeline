export type { AngeLifelineApiPaths } from "./client-config";
export {
  configureAngeLifelineApi,
  getAngeLifelineApiPaths,
} from "./client-config";

export { buildAngeLifelineNumbersBlockForChat } from "./crisis-chat-lines";

export {
  fallbackSuicideHelplines,
  fallbackSuicideHelplinesForChineseLocale,
} from "./crisis-helpline-fallback";

export type {
  CrisisHelplineLine,
  CrisisHelplinesResult,
} from "./crisis-helpline-types";

export type { CrisisFocus } from "./crisis-focus";
export { inferCrisisFocus, isSuicidalCrisis } from "./crisis-focus";

export {
  inferChineseCrisisHelplineLocale,
  inferPrimaryEmergencyFromLanguage,
  primaryEmergencyDisplaysForChineseLocale,
  type ChineseCrisisHelplineLocale,
} from "./crisis-language-locale";

export {
  emergencyDisplayFromCountryCode,
  emergencyDisplayFromSearch,
  inferCountryCodeFromChat,
} from "./country-emergency";

export {
  emergencyRegionFromRegionHint,
  findAHelplineUrl,
  inferEmergencyRegion,
  inferHelplineCountryCode,
  resolveEmergencyDisplay,
  emergencyRegionFromCountryCode,
  type EmergencyDisplay,
  type EmergencyRegion,
} from "./emergency-routing";

export { fetchCrisisHelplines } from "./fetch-crisis-helplines";

export {
  crisisSearchQuery,
  hasResolvablePlaceHint,
  resolveSecondaryLines,
  type SecondaryLinesResult,
} from "./fetch-secondary-lines";

export { resolveLiveEventLookup, LIVE_SEARCH_EVENTS } from "./festival-places";

export type { PlacesVenueResolved } from "./google-places-lookup";

export {
  hasLocationContext,
  hasLocationContextFromText,
} from "./location-context";

export type { UiLocale } from "./locale";
export { isUiLocale } from "./locale";

export {
  extractExplicitRegionHint,
  extractPlaceHints,
  extractRegionHint,
} from "./place-hints";

export { placeLookupFromKeywords, PLACE_KEYWORD_ENTRIES } from "./place-keywords";

export {
  analyzeForRedFlag,
  type RedFlagAnalysis,
} from "./red-flag-analyzer";

export {
  detectHardCrisis,
  normalizeCrisisInput,
} from "./hard-crisis-detection";

export {
  RULES,
  checkMessage,
  decide,
  detectRules,
  normalizeText,
  type Category,
  type DecideOptions,
  type Decision,
  type Level,
  type RuleHit,
  type RuleResult,
} from "./angelifeline-rules";

export {
  assessCrisisWithGemini,
  type GeminiCrisisTriage,
} from "./gemini-crisis-triage";

export { maskPII, MASK_LIMITS, type MaskCounts } from "./angelifeline-mask";

export {
  normalizeVenueLookupRequest,
  venueGroundingText,
} from "./angelifeline-venue-privacy";

export { JUDGE_PROMPT_VERSION, JUDGE_SYSTEM_PROMPT } from "./angelifeline-judge-prompt";

export { handleJudgePost, judgeMaskedText } from "./angelifeline-judge-server";

export {
  DEFAULT_CONFIG as PIPELINE_DEFAULT_CONFIG,
  EMS as PIPELINE_EMS,
  UNIVERSAL as PIPELINE_UNIVERSAL_EMS,
  buildCard,
  createHttpJudge,
  createHttpLookup,
  createSession,
  detectLang,
  extractPlaceHint,
  parseVerdict,
  processMessage,
  type Action,
  type EmsCard,
  type PipelineConfig,
  type PipelineDeps,
  type Session,
} from "./angelifeline-pipeline";

export {
  resolveHardCrisis,
  type HardCrisisResolution,
} from "./resolve-hard-crisis";

export { fetchCrisisTriage } from "./fetch-crisis-triage";

export { shouldOpenAngeLifelineOverlay } from "./resolve-hard-crisis";

export { resolveCrisisHelplines } from "./resolve-crisis-helplines";
export { resolveVenueForCrisis } from "./resolve-venue-for-crisis";

export type { SecondaryLine, VenueLookupRequest } from "./routing-policy";
export {
  parseVenueLookupRequest,
  sortSecondaryLines,
} from "./routing-policy";

export {
  classifyDeviceTelephony,
  type DeviceTelephonyClass,
} from "./device-capabilities";

export { textContainsSimplifiedChinese } from "./simplified-chinese";

export {
  getAngeLifelineEmbedDisclaimer,
  getAngeLifelineOverlayDisclaimer,
  type AngeLifelineEmbedDisclaimer,
  type AngeLifelineOverlayDisclaimer,
} from "./disclaimer";
