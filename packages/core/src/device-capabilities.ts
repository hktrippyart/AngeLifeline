export type DeviceTelephonyClass = "telephony" | "non-telephony";

/**
 * Heuristic telephony detection (UA-based). iPad/Mac/desktop → non-telephony.
 */
export function classifyDeviceTelephony(userAgent: string): DeviceTelephonyClass {
  const ua = userAgent.toLowerCase();

  const isIPhone = /iphone|ipod/.test(ua);
  const isAndroidPhone =
    /android/.test(ua) && /mobile/.test(ua) && !/tablet/.test(ua);

  if (isIPhone || isAndroidPhone) {
    return "telephony";
  }

  return "non-telephony";
}

/** Client-only — UA plus touch / viewport heuristics (in-app browsers, odd UAs). */
export function classifyDeviceTelephonyClient(): DeviceTelephonyClass {
  if (typeof navigator === "undefined") return "non-telephony";
  if (classifyDeviceTelephony(navigator.userAgent) === "telephony") {
    return "telephony";
  }
  if (typeof window === "undefined") return "non-telephony";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 520px)").matches;
  if (coarse && narrow && navigator.maxTouchPoints > 0) {
    return "telephony";
  }
  return "non-telephony";
}
