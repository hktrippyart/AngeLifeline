export type DeviceTelephonyClass = "telephony" | "non-telephony";

/**
 * Heuristic telephony detection (UA-based). iPad/Mac/desktop → non-telephony.
 */
export function classifyDeviceTelephony(userAgent: string): DeviceTelephonyClass {
  const ua = userAgent.toLowerCase();

  const isIPhone = /iphone/.test(ua);
  const isAndroidPhone =
    /android/.test(ua) && /mobile/.test(ua) && !/tablet/.test(ua);

  if (isIPhone || isAndroidPhone) {
    return "telephony";
  }

  return "non-telephony";
}
