export type CrisisHelplineLine = {
  name: string;
  labelEn: string;
  labelZh: string;
  tel?: string;
  sms?: string;
  webChatUrl?: string;
  source: "throughline" | "fallback";
};

import type { EmergencyDisplay } from "./emergency-routing";

export type CrisisHelplinesResult = {
  configured: boolean;
  needsLocation: boolean;
  countryCode?: string;
  /** Primary EMS (999, 119, …) when location unknown but language implies region. */
  primaryEmergency?: EmergencyDisplay[];
  lines: CrisisHelplineLine[];
};
