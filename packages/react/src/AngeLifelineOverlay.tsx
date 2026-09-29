"use client";

import { createPortal } from "react-dom";
import type { CrisisHelplinesResult } from "@angelifeline/core";
import type { RedFlagAnalysis } from "@angelifeline/core";
import type { DeviceTelephonyClass } from "@angelifeline/core";
import type { SecondaryLine } from "@angelifeline/core";
import {
  findAHelplineUrl,
  resolveEmergencyDisplay,
  type EmergencyDisplay,
} from "@angelifeline/core";
import type { UiLocale } from "@angelifeline/core";
import { getAngeLifelineOverlayDisclaimer } from "@angelifeline/core";

type Props = {
  uiLocale: UiLocale;
  analysis: RedFlagAnalysis;
  telephony: DeviceTelephonyClass;
  secondaryLines?: SecondaryLine[];
  crisisHelplines?: CrisisHelplinesResult | null;
  chatSnippet?: string;
  resolvingLocation?: boolean;
  onDismiss?: () => void;
};

function secondaryHeading(zh: boolean): string {
  return zh ? "場地 / 活動線路" : "Event / venue line";
}

function crisisHeading(zh: boolean): string {
  return zh ? "自殺／情緒危機熱線" : "Suicide & crisis support";
}

export function AngeLifelineOverlay({
  uiLocale,
  analysis,
  telephony,
  secondaryLines = [],
  crisisHelplines,
  chatSnippet,
  resolvingLocation = false,
  onDismiss,
}: Props) {
  const zh = uiLocale === "zh-Hant" || analysis.preferHongKong;
  const showCrisisLines =
    analysis.crisisFocus === "suicide" || analysis.crisisFocus === "mixed";
  const helplineUrl = findAHelplineUrl({
    chatSnippet,
    regionHint: analysis.regionHint,
    emergencyRegion: analysis.emergencyRegion,
    countryCode: analysis.countryCode,
  });
  const emergencyDisplay = resolveEmergencyDisplay(uiLocale, {
    regionHint: analysis.regionHint,
    emergencyRegion: analysis.emergencyRegion,
    countryCode: analysis.countryCode,
    emergencyNumber: analysis.emergencyNumber,
    locationKnown: analysis.locationKnown,
    withholdEmsWithoutLocation: analysis.crisisFocus === "suicide",
  });
  const emergency = emergencyDisplay.number;
  const locationUnknown = emergencyDisplay.locationUnknown === true;
  const languagePrimaryEms = crisisHelplines?.primaryEmergency ?? [];

  const primaryEmsDisplays: EmergencyDisplay[] = (() => {
    if (!locationUnknown && emergency) {
      return [emergencyDisplay];
    }
    if (languagePrimaryEms.length > 0) {
      return languagePrimaryEms;
    }
    if (locationUnknown) {
      return [];
    }
    if (emergency) {
      return [emergencyDisplay];
    }
    return [];
  })();

  const primaryEmsNumbers = new Set(
    primaryEmsDisplays.map((d) => d.number.replace(/\s/g, "")),
  );

  const showUnknownEmsCopy =
    locationUnknown &&
    languagePrimaryEms.length === 0 &&
    primaryEmsDisplays.length === 0;

  const venueLines = secondaryLines.filter(
    (line) =>
      line.source !== "places" &&
      !primaryEmsNumbers.has(line.tel.replace(/\s/g, "")),
  );

  const crisisLines = crisisHelplines?.lines ?? [];
  const languageFallbackLines =
    showCrisisLines &&
    crisisHelplines?.needsLocation === true &&
    crisisLines.length > 0;

  const needsLocationAsk =
    showCrisisLines &&
    !resolvingLocation &&
    (crisisHelplines?.needsLocation === true || !analysis.locationKnown) &&
    crisisLines.length === 0;

  const overlayDisclaimer = getAngeLifelineOverlayDisclaimer(uiLocale, {
    preferHongKong: analysis.preferHongKong,
  });

  const overlay = (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-moss/40 p-4 backdrop-blur-md sm:p-6"
      role="alertdialog"
      aria-labelledby="lifeline-title"
      aria-describedby="lifeline-desc"
    >
      <div className="mx-auto flex w-full max-w-xl justify-center py-[max(1.5rem,8vh)]">
        <div className="w-full rounded-3xl border border-line bg-void p-5 shadow-xl ring-1 ring-line sm:p-7">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">
            AngeLifeline
          </p>
          <h2
            id="lifeline-title"
            className="mt-2 font-display text-2xl font-semibold tracking-tight text-fog sm:text-3xl"
          >
            {zh ? "我哋喺度，先處理安全" : "You’re not alone — safety first"}
          </h2>
          <p
            id="lifeline-desc"
            className="mt-3 text-sm leading-relaxed text-mist"
          >
            {overlayDisclaimer.scope}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {overlayDisclaimer.accuracy}
          </p>

          {resolvingLocation ? (
            <p className="mt-4 rounded-2xl border border-line bg-deep px-4 py-3 text-sm leading-relaxed text-mist">
              {zh
                ? "正在用 Google 搜尋同地圖確認你嘅位置同緊急號碼…"
                : "Confirming your location and emergency number via search and Maps…"}
            </p>
          ) : null}

          {languageFallbackLines ? (
            <p className="mt-4 rounded-2xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm leading-relaxed text-fog">
              {zh
                ? "我哋未知道你在邊。下面有按你所用中文顯示嘅緊急號碼（例如 999、119）同自殺／情緒危機熱線。講國家或城市可以更新更啱嘅號碼。"
                : "We don’t know where you are yet. Below are emergency numbers (e.g. 999, 119) and suicide crisis lines matched to the Chinese you’re using. Tell us your city or country in chat to refine."}
            </p>
          ) : null}

          {needsLocationAsk ? (
            <p className="mt-4 rounded-2xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm leading-relaxed text-fog">
              {zh
                ? "我哋未知道你在邊。請喺對話度講國家或城市（例如「香港」），我哋就會更新啱你嘅號碼。"
                : "We don’t know where you are yet. Reply in chat with your country or city (e.g. “Hong Kong”) and we’ll update the numbers here."}
            </p>
          ) : null}

          {telephony === "telephony" &&
          (primaryEmsDisplays.length > 0 || crisisLines.length > 0) ? (
            <div className="mt-6 flex flex-col gap-3">
              {primaryEmsDisplays.map((ems) => (
                <a
                  key={`ems-tel-${ems.number}`}
                  href={`tel:${ems.number.replace(/\s/g, "")}`}
                  className="flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-danger px-4 py-3 text-center text-base font-semibold text-void transition hover:opacity-90 sm:text-lg"
                >
                  {zh ? ems.labelZh : ems.labelEn}
                </a>
              ))}
              {crisisLines.map((line) =>
                line.tel ? (
                  <a
                    key={`crisis-${line.name}-${line.tel}`}
                    href={`tel:${line.tel.replace(/\s/g, "")}`}
                    className="flex min-h-[3rem] items-center justify-center rounded-2xl bg-ember px-4 py-3 text-center text-sm font-semibold text-void transition hover:bg-ember-bright sm:text-base"
                  >
                    {zh ? line.labelZh : line.labelEn}
                  </a>
                ) : null,
              )}
              {venueLines.map((line) => (
                <a
                  key={`${line.source}-${line.tel}-${line.labelEn}`}
                  href={`tel:${line.tel.replace(/\s/g, "")}`}
                  className="flex min-h-[3rem] items-center justify-center rounded-2xl bg-deep px-4 py-3 text-center text-sm font-semibold text-fog ring-1 ring-line transition hover:bg-moss sm:text-base"
                >
                  {zh ? line.labelZh : line.labelEn}
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {primaryEmsDisplays.map((ems) => (
                <div
                  key={`ems-card-${ems.number}`}
                  className="rounded-2xl border-2 border-danger/35 bg-danger/5 px-4 py-4 text-center sm:px-5 sm:py-5"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-mist">
                    {zh ? "緊急服務" : "Emergency services"}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-snug text-fog">
                    {zh ? ems.labelZh : ems.labelEn}
                  </p>
                  <p className="mt-2 font-mono text-4xl font-semibold tracking-wide text-fog sm:text-5xl">
                    {ems.number}
                  </p>
                  {ems.subnoteEn ? (
                    <p className="mt-2 text-xs leading-relaxed text-mist">
                      {zh ? ems.subnoteZh : ems.subnoteEn}
                    </p>
                  ) : null}
                </div>
              ))}

              {showUnknownEmsCopy ? (
                <div className="rounded-2xl border-2 border-danger/35 bg-danger/5 px-4 py-4 text-center sm:px-5 sm:py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-mist">
                    {zh ? "緊急服務" : "Emergency services"}
                  </p>
                  <p className="mt-3 text-base font-semibold leading-snug text-fog sm:text-lg">
                    {zh ? emergencyDisplay.labelZh : emergencyDisplay.labelEn}
                  </p>
                  {emergencyDisplay.subnoteEn ? (
                    <p className="mt-2 text-xs leading-relaxed text-mist">
                      {zh
                        ? emergencyDisplay.subnoteZh
                        : emergencyDisplay.subnoteEn}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {primaryEmsDisplays.length > 0 ? (
                <p className="text-center text-xs leading-relaxed text-mist">
                  {zh
                    ? "此裝置可能無法直接撥打電話，請手動撥號或使用另一部電話。"
                    : "This device may not place calls directly — dial manually or use another phone."}
                </p>
              ) : null}

              {showCrisisLines && crisisLines.length > 0 ? (
                <div className="rounded-2xl border border-ember/35 bg-ember/5 px-4 py-3 sm:px-5 sm:py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-mist">
                    {crisisHeading(zh)}
                  </p>
                  <ul className="mt-3 divide-y divide-line/80">
                    {crisisLines.map((line) => (
                      <li
                        key={`crisis-${line.name}-${line.tel ?? line.sms}`}
                        className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <p className="text-sm font-medium leading-snug text-fog">
                          {zh ? line.labelZh : line.labelEn}
                        </p>
                        {line.tel ? (
                          <p className="shrink-0 font-mono text-xl font-semibold tracking-wide text-ember sm:text-2xl">
                            {line.tel}
                          </p>
                        ) : line.sms ? (
                          <p className="shrink-0 text-sm text-mist">
                            SMS: {line.sms}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {venueLines.length > 0 ? (
                <div className="rounded-2xl border border-line bg-deep px-4 py-3 sm:px-5 sm:py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-mist">
                    {secondaryHeading(zh)}
                  </p>
                  <ul className="mt-3 divide-y divide-line">
                    {venueLines.map((line) => (
                      <li
                        key={`${line.source}-${line.tel}-${line.labelEn}`}
                        className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <p className="text-sm font-medium leading-snug text-fog">
                          {zh ? line.labelZh : line.labelEn}
                        </p>
                        <p className="shrink-0 font-mono text-xl font-semibold tracking-wide text-ember sm:text-2xl">
                          {line.tel}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-mist">
            {zh ? "更多危機熱線：" : "More crisis lines:"}{" "}
            <a
              href={helplineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ember underline-offset-2 hover:underline"
            >
              findahelpline.com
            </a>
          </p>

          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="mt-4 w-full text-center text-xs text-mist underline-offset-2 hover:underline"
            >
              {zh ? "我而家安全，返回對話" : "I’m safe — return to chat"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
