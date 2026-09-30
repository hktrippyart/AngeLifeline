import type { UiLocale } from "./locale";

export type AngeLifelineOverlayDisclaimer = {
  scope: string;
  accuracy: string;
};

export type AngeLifelineEmbedDisclaimer = {
  title: string;
  paragraphs: string[];
  acknowledgeLabel: string;
};

const overlayEn: AngeLifelineOverlayDisclaimer = {
  scope:
    "This is not medical or law enforcement. Use emergency services for immediate danger; for emotional crisis, use the support lines below.",
  accuracy:
    "Numbers here are suggestions from chat context and automated lookup — not verified dispatch. If anything looks wrong, call your local emergency number directly.",
};

const overlayZhHant: AngeLifelineOverlayDisclaimer = {
  scope:
    "呢個介面唔係醫療或執法服務。如有即時危險請用緊急服務；如果係情緒危機，下面有專門熱線。",
  accuracy:
    "以下號碼係按對話同自動查詢建議，未必準確或完整；如有疑問請直接致電當地緊急服務。",
};

const embedEn: AngeLifelineEmbedDisclaimer = {
  title: "About AngeLifeline in this app",
  paragraphs: [
    "AngeLifeline is a crisis overlay: when chat text looks like an emergency, it shows local emergency and crisis numbers. It is not medical care, therapy, law enforcement, or emergency dispatch.",
    "Numbers and place hints come from rules, optional web search, and third-party APIs. They may be wrong, outdated, or incomplete. In immediate danger, call local emergency services yourself — do not wait for the app.",
    "AngeLifeline does not use GPS or your IP address to find you. Location comes from what you type in chat (and optional event settings from the host).",
    "The host’s chat or AI is separate from AngeLifeline. The overlay only suggests numbers; it cannot send help to your location.",
  ],
  acknowledgeLabel:
    "I understand AngeLifeline is not emergency dispatch and numbers may need verification.",
};

const embedZhHant: AngeLifelineEmbedDisclaimer = {
  title: "關於 AngeLifeline（危機畫面）",
  paragraphs: [
    "AngeLifeline 係危機畫面：當對話好似緊急情況，會顯示當地緊急同危機熱線。佢唔係醫療、輔導、執法或代你報警嘅服務。",
    "號碼同地點提示來自規則、可選嘅網上搜尋同第三方 API，可能錯、過時或不完整。如有即時危險，請你自己致電當地緊急服務，唔好只等 app。",
    "AngeLifeline 唔會用 GPS 或 IP 定位；位置來自你在對話輸入嘅內容（同主辦方可選嘅活動設定）。",
    "主辦方嘅聊天或 AI 同 AngeLifeline 分開；畫面只係建議號碼，唔可以派人去你所在位置。",
  ],
  acknowledgeLabel:
    "我明白 AngeLifeline 唔係緊急調度，號碼可能需要自行核實。",
};

export function getAngeLifelineOverlayDisclaimer(
  uiLocale: UiLocale,
  options?: { preferHongKong?: boolean },
): AngeLifelineOverlayDisclaimer {
  const zh = uiLocale === "zh-Hant" || options?.preferHongKong === true;
  return zh ? overlayZhHant : overlayEn;
}

export function getAngeLifelineEmbedDisclaimer(
  uiLocale: UiLocale,
): AngeLifelineEmbedDisclaimer {
  return uiLocale === "zh-Hant" ? embedZhHant : embedEn;
}
