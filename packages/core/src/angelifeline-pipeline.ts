// angelifeline-pipeline.ts
// 危機偵測流程（瀏覽器端）：
//   1. 本地規則（用原文）→ 字面明確即時彈 overlay，唔使等 LLM
//   2. 本地遮蔽個人資料
//   3. LLM 判斷（只收遮蔽後嘅文字；3 秒超時；固定 JSON 格式）
//   4. 合併決定：規則 high 或者 LLM urgent → overlay；LLM concern → 柔和提示
//   5. LLM 失敗／超時／被擋／空白 → 退返去規則同靜態緊急電話，overlay 永遠唔會空白
//   6. 緊急電話按地區揀（地點提示 > 時區 > 瀏覽器語言 > 訊息語言 > 網站預設）
//   7. Overlay 彈咗但未知地點：之後幾句訊息留意用戶有冇提供地點／活動，有就更新 overlay
//
// 本檔案冇任何 import：所有依賴（規則、遮蔽、LLM、地點查詢）由 deps 傳入，方便測試同換供應商。
//
// 安全設計原則
// - 規則 high 唔會被 LLM 取消（high 時根本唔會叫 LLM）。
// - 緊急電話只用「靜態表」。AI 搜尋回傳嘅號碼只會當「補充資料」顯示，絕不取代靜態緊急電話（LLM 可能出錯）。
// - 任何會送出網絡嘅嘢，只有：遮蔽後嘅訊息（俾 judge），同埋「地點提示」（俾 lookup），唔會送整段對話去搜尋。
// - session 只存喺記憶體，唔寫入磁碟，亦唔記錄用戶原文。

/* ------------------------------------------------------------------ */
/* 類型                                                                 */
/* ------------------------------------------------------------------ */

export type Lang = "yue" | "zh-Hant" | "zh-Hans" | "en" | "unknown";
export type JudgeLevel = "none" | "concern" | "urgent";
export type JudgeCategory = "self_harm" | "violence" | "medical" | "other" | "none";
export interface Verdict {
  level: JudgeLevel;
  category: JudgeCategory;
}
export type JudgeStatus = "ok" | "timeout" | "error" | "invalid" | "blocked";
export type JudgeResult =
  | { status: "ok"; verdict: Verdict; ms: number }
  | { status: "timeout" | "error" | "invalid" | "blocked"; ms: number };

/** 回傳 LLM 嘅原始結果（物件或者 JSON 字串）。被擋／空白回傳 null。 */
export type Judge = (maskedText: string, signal: AbortSignal) => Promise<unknown>;

export interface PlaceHint {
  kind: "place" | "event" | "phrase";
  text: string;
  region?: string; // 如果本地地名表認得，就有地區代碼（例如 "HK"）
}

export interface LookupInput {
  kind: PlaceHint["kind"];
  text: string;
  region?: string;
}
/** 地點／活動查詢（例如你現有嘅 venue-lookup route）。只會收到地點提示，唔會收到整段對話。 */
export type Lookup = (input: LookupInput, signal: AbortSignal) => Promise<unknown>;

export interface RuleResultLike {
  level: "none" | "review" | "high";
  categories: string[];
  hits: { id: string }[];
}

export interface EmsNumber {
  tel: string;
  zh: string;
  en: string;
}
export interface RegionInfo {
  label: { zh: string; en: string };
  numbers: EmsNumber[];
}
export interface ExtraNumber {
  label: string;
  tel: string;
  source: "ai_search";
}
export interface EmsCard {
  region: string;
  regionLabel: { zh: string; en: string };
  numbers: EmsNumber[]; // 一定有至少一個
  universal: EmsNumber; // 112 提示
  confidence: "known" | "guess";
  askLocation: boolean; // UI 可以顯示「你而家喺邊度？」
  extras?: ExtraNumber[]; // AI 搜尋補充（要顯示「請核實」）
  venue?: { name?: string; note?: string };
}

export type OverlayReason = "rule_high" | "llm_urgent" | "rule_review+llm_concern" | "rule_review_llm_unavailable";

export type Action =
  | { type: "overlay"; reason: OverlayReason; categories: string[]; ems: EmsCard; repeat: boolean }
  | { type: "overlay_update"; reason: "place_hint" | "lookup"; ems: EmsCard }
  | { type: "soft_prompt"; categories: string[] }
  | { type: "none" };

export interface Debug {
  ruleLevel: "none" | "review" | "high";
  ruleIds: string[];
  judge: JudgeStatus | "skipped";
  judgeLevel?: JudgeLevel;
  judgeMs?: number;
  lang: Lang;
  region: string;
  regionConfidence: "known" | "guess";
  // 刻意冇用戶原文
}

export interface PipelineResult {
  action: Action;
  followUp?: Promise<Action | null>; // 例如地點查詢完成後嘅 overlay 更新（可以忽略）
  debug: Debug;
}

export interface Env {
  timezone?: string; // Intl.DateTimeFormat().resolvedOptions().timeZone
  locale?: string; // navigator.language
}

export interface PipelineConfig {
  siteRegion: string; // 網站預設地區
  judgeTimeoutMs: number;
  lookupTimeoutMs: number;
  awaitWindowMessages: number; // overlay 之後追蹤地點幾多句
  reviewPlusConcernEscalates: boolean; // 規則 review + LLM concern → overlay
  knownEvents: { name: string; region?: string }[]; // 你自己維護嘅活動／場地名單
}

export const DEFAULT_CONFIG: PipelineConfig = {
  siteRegion: "HK",
  judgeTimeoutMs: 3000,
  lookupTimeoutMs: 2500,
  awaitWindowMessages: 6,
  reviewPlusConcernEscalates: true,
  knownEvents: [],
};

export interface PipelineDeps {
  detectRules: (text: string) => RuleResultLike;
  maskPII: (text: string) => { text: string };
  judge?: Judge;
  lookup?: Lookup;
  env?: Env;
  config?: Partial<PipelineConfig>;
}

export interface Session {
  messageCount: number;
  langVotes: Record<string, number>;
  lastLang: Lang;
  overlay?: { atMessage: number; region: string; confidence: "known" | "guess" };
  awaitingPlace: boolean;
  sinceOverlay: number;
  usedHints: string[];
}

export function createSession(): Session {
  return { messageCount: 0, langVotes: {}, lastLang: "unknown", awaitingPlace: false, sinceOverlay: 0, usedHints: [] };
}

/* ------------------------------------------------------------------ */
/* 靜態緊急電話表                                                        */
/* ------------------------------------------------------------------ */
// ⚠️ 上線前必須由人手逐個核對（官方網站），並記錄核對日期。呢度只係初稿。
// 緊急電話只用呢張表，唔用 AI 搜尋結果。

export const EMS_LAST_VERIFIED = ""; // 例如 "2026-10-08"，核對後填寫

const POLICE_FIRE_AMB: EmsNumber = { tel: "999", zh: "警察、消防、救護車", en: "Police, fire, ambulance" };

export const EMS: Record<string, RegionInfo> = {
  HK: { label: { zh: "香港", en: "Hong Kong" }, numbers: [POLICE_FIRE_AMB] },
  MO: { label: { zh: "澳門", en: "Macau" }, numbers: [POLICE_FIRE_AMB] },
  TW: {
    label: { zh: "台灣", en: "Taiwan" },
    numbers: [
      { tel: "119", zh: "消防、救護車", en: "Fire, ambulance" },
      { tel: "110", zh: "警察", en: "Police" },
    ],
  },
  CN: {
    label: { zh: "中國內地", en: "Mainland China" },
    numbers: [
      { tel: "120", zh: "救護車", en: "Ambulance" },
      { tel: "110", zh: "警察", en: "Police" },
      { tel: "119", zh: "消防", en: "Fire" },
    ],
  },
  SG: {
    label: { zh: "新加坡", en: "Singapore" },
    numbers: [
      { tel: "995", zh: "救護車、消防", en: "Ambulance, fire" },
      { tel: "999", zh: "警察", en: "Police" },
    ],
  },
  JP: {
    label: { zh: "日本", en: "Japan" },
    numbers: [
      { tel: "119", zh: "救護車、消防", en: "Ambulance, fire" },
      { tel: "110", zh: "警察", en: "Police" },
    ],
  },
  GB: { label: { zh: "英國", en: "United Kingdom" }, numbers: [{ tel: "999", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }] },
  US: { label: { zh: "美國", en: "United States" }, numbers: [{ tel: "911", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }] },
  CA: { label: { zh: "加拿大", en: "Canada" }, numbers: [{ tel: "911", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }] },
  AU: { label: { zh: "澳洲", en: "Australia" }, numbers: [{ tel: "000", zh: "警察、消防、救護車", en: "Police, fire, ambulance" }] },
};

export const UNIVERSAL: EmsNumber = {
  tel: "112",
  zh: "喺好多地方，手機撥 112 可以轉駁當地緊急服務",
  en: "On many mobile networks, 112 connects to local emergency services",
};

const TZ_REGION: Record<string, string> = {
  "Asia/Hong_Kong": "HK",
  "Asia/Macau": "MO",
  "Asia/Taipei": "TW",
  "Asia/Shanghai": "CN",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Europe/London": "GB",
};

export function regionFromTimezone(tz?: string): string | null {
  if (!tz) return null;
  if (TZ_REGION[tz]) return TZ_REGION[tz];
  if (/^Australia\//.test(tz)) return "AU";
  if (/^America\/(?:Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)$/.test(tz)) return "CA";
  if (/^America\/(?:New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise)$/.test(tz)) return "US";
  return null;
}

export function regionFromLocale(locale?: string): string | null {
  if (!locale) return null;
  const m = /[-_]([A-Za-z]{2})$/.exec(locale.trim());
  if (!m) return null;
  const r = m[1].toUpperCase();
  return EMS[r] ? r : null;
}

/* ------------------------------------------------------------------ */
/* 語言偵測（只用嚟估地區，唔係嚴謹嘅語言識別）                              */
/* ------------------------------------------------------------------ */

const CANTONESE_MARKERS = /[嘅咗唔冇喺佢哋嘢啲咁嚟乜嗰俾咩啱睇諗瞓攰嬲]/;
const SIMPLIFIED_MARKERS = /[这个们说话会为没对还来时开见发应该么吗]/;

export function detectLang(text: string): Lang {
  const t = String(text ?? "");
  if (/[\u4e00-\u9fff]/.test(t)) {
    if (CANTONESE_MARKERS.test(t)) return "yue";
    if (SIMPLIFIED_MARKERS.test(t)) return "zh-Hans";
    return "zh-Hant";
  }
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  return letters >= 3 ? "en" : "unknown";
}

export function sessionLang(s: Session): Lang {
  let best: Lang = s.lastLang;
  let bestVotes = s.langVotes[s.lastLang] ?? 0;
  for (const k of Object.keys(s.langVotes)) {
    if (s.langVotes[k] > bestVotes) {
      best = k as Lang;
      bestVotes = s.langVotes[k];
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 地點／活動提示（本地抽取）                                              */
/* ------------------------------------------------------------------ */
// 地名表只係示範，要按你嘅服務地區同活動名單擴充（config.knownEvents 可以加）。

const GAZETTEER: [string[], string][] = [
  [["香港", "Hong Kong", "HK", "中環", "灣仔", "銅鑼灣", "尖沙咀", "旺角", "佐敦", "油麻地", "深水埗", "觀塘", "九龍灣", "荃灣", "沙田", "大埔", "屯門", "元朗", "將軍澳", "西貢", "長洲", "南丫島", "大嶼山", "赤鱲角", "石澳", "蘭桂坊", "啟德", "西九", "紅磡", "港島", "九龍", "新界", "Wan Chai", "Causeway Bay", "Tsim Sha Tsui", "TST", "Mong Kok", "Lan Kwai Fong", "LKF", "Kwun Tong", "Sai Kung", "Lantau", "Cheung Chau", "Lamma"], "HK"],
  [["澳門", "Macau", "Macao", "氹仔", "路環"], "MO"],
  [["台灣", "臺灣", "台北", "臺北", "台中", "台南", "高雄", "Taiwan", "Taipei", "Kaohsiung"], "TW"],
  [["深圳", "廣州", "廣東", "北京", "上海", "Shenzhen", "Guangzhou", "Beijing", "Shanghai"], "CN"],
  [["新加坡", "Singapore"], "SG"],
  [["日本", "東京", "大阪", "京都", "Tokyo", "Osaka", "Kyoto", "Japan"], "JP"],
  [["倫敦", "London", "England", "Manchester"], "GB"],
  [["紐約", "New York", "California", "Los Angeles", "Las Vegas"], "US"],
  [["Sydney", "Melbourne", "悉尼", "墨爾本"], "AU"],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isAscii = (s: string) => /^[\x00-\x7F]+$/.test(s);

function matchName(text: string, name: string): boolean {
  if (isAscii(name)) return new RegExp("(?:^|[^A-Za-z0-9])" + escapeRe(name) + "(?:$|[^A-Za-z0-9])", "i").test(text);
  return text.includes(name);
}

const CJK_VENUE_SUFFIX = /(?:酒店|酒吧|夜店|會所|商場|廣場|大廈|中心|公園|沙灘|碼頭|機場|車站|站|街|路|道|村|島|音樂節|音樂祭|節|祭|場)$/;
const CJK_STOP = /^(?:屋企|家|度|呢度|嗰度|這裡|這裏|呢到|嗰到|街度|附近|身邊|房|房間|廁所|洗手間)$/;

export function extractPlaceHint(text: string, cfg: Pick<PipelineConfig, "knownEvents"> = DEFAULT_CONFIG): PlaceHint | null {
  const t = String(text ?? "");

  // 1) 你維護嘅活動／場地名單
  for (const ev of cfg.knownEvents) {
    if (ev.name && matchName(t, ev.name)) return { kind: "event", text: ev.name, region: ev.region };
  }

  // 2) 地名表（長名優先）
  const entries: { name: string; region: string }[] = [];
  for (const [names, region] of GAZETTEER) for (const name of names) entries.push({ name, region });
  entries.sort((a, b) => b.name.length - a.name.length);
  for (const e of entries) {
    if (matchName(t, e.name)) return { kind: "place", text: e.name, region: e.region };
  }

  // 3) 專有名詞＋場地字眼，例如「Zero Club」「Clockenflap Festival」
  const venueEn = /\b([A-Z][\w'&-]+(?:\s+[A-Z][\w'&-]+){0,3})\s+(?:Festival|Club|Bar|Hotel|Station|Beach|Park|Hospital|Airport|Pier)\b/.exec(t);
  if (venueEn) return { kind: "phrase", text: venueEn[0].trim() };

  // 4) 「喺／在／at／in」後面緊接專有名詞（英文要大寫開頭；中文要有場地字尾），減少雜訊
  const m = /(?:喺|在|於|\bat\b|\bin\b|@|\bnear\b|附近|嚟到)\s*([A-Z][A-Za-z0-9'&-]*(?:\s+[A-Z0-9][A-Za-z0-9'&-]*){0,3}|[\u4e00-\u9fff]{2,10})/.exec(t);
  if (m) {
    const cand = m[1].trim();
    if (/[\u4e00-\u9fff]/.test(cand)) {
      if (!CJK_STOP.test(cand) && CJK_VENUE_SUFFIX.test(cand)) return { kind: "phrase", text: cand };
    } else if (cand.length >= 3) {
      return { kind: "phrase", text: cand };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Judge（LLM）+ 超時                                                    */
/* ------------------------------------------------------------------ */

export function parseVerdict(raw: unknown): Verdict | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const m = /\{[\s\S]*\}/.exec(raw);
    if (!m) return null;
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const level = String(o.level ?? "").toLowerCase().trim();
  if (level !== "none" && level !== "concern" && level !== "urgent") return null;
  const cat = String(o.category ?? "none").toLowerCase().trim();
  const category = (["self_harm", "violence", "medical", "other", "none"].includes(cat) ? cat : "other") as JudgeCategory;
  return { level: level as JudgeLevel, category };
}

const TIMEOUT = Symbol("timeout");

export async function runJudge(judge: Judge, maskedText: string, timeoutMs: number): Promise<JudgeResult> {
  const t0 = Date.now();
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => {
      ac.abort();
      resolve(TIMEOUT);
    }, timeoutMs);
  });
  try {
    const raced = await Promise.race([Promise.resolve().then(() => judge(maskedText, ac.signal)), timeout]);
    const ms = Date.now() - t0;
    if (raced === TIMEOUT) return { status: "timeout", ms };
    if (raced === null || raced === undefined || raced === "") return { status: "blocked", ms };
    const verdict = parseVerdict(raced);
    return verdict ? { status: "ok", verdict, ms } : { status: "invalid", ms };
  } catch {
    return { status: ac.signal.aborted ? "timeout" : "error", ms: Date.now() - t0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 瀏覽器端 adapter：呼叫你自己嘅後端 route（後端先持有 API key）。 */
export function createHttpJudge(url: string, fetchImpl?: typeof fetch): Judge {
  return async (text, signal) => {
    const f = fetchImpl ?? fetch;
    const res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal });
    if (!res.ok) throw new Error("judge_http_" + res.status);
    const data = (await res.json()) as Record<string, unknown> | null;
    if (data && data.blocked) return null;
    return data;
  };
}

/** 瀏覽器端 adapter：地點／活動查詢，只傳遮蔽後嘅 placeHint（同 optional region）。 */
export function createHttpLookup(url: string, fetchImpl?: typeof fetch): Lookup {
  return async (input, signal) => {
    const f = fetchImpl ?? fetch;
    const res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        placeHint: input.text,
        regionHint: input.region,
      }),
      signal,
    });
    if (!res.ok) throw new Error("lookup_http_" + res.status);
    return res.json();
  };
}

/* ------------------------------------------------------------------ */
/* 緊急電話卡                                                           */
/* ------------------------------------------------------------------ */

export function inferRegion(
  session: Session,
  env: Env | undefined,
  hint: PlaceHint | null,
  cfg: Pick<PipelineConfig, "siteRegion">,
): { region: string; confidence: "known" | "guess" } {
  if (hint?.region && EMS[hint.region]) return { region: hint.region, confidence: "known" };
  const tz = regionFromTimezone(env?.timezone);
  if (tz && EMS[tz]) return { region: tz, confidence: "guess" };
  const loc = regionFromLocale(env?.locale);
  if (loc) return { region: loc, confidence: "guess" };
  if (sessionLang(session) === "yue") return { region: "HK", confidence: "guess" };
  return { region: EMS[cfg.siteRegion] ? cfg.siteRegion : "HK", confidence: "guess" };
}

export function buildCard(region: string, confidence: "known" | "guess"): EmsCard {
  const info = EMS[region] ?? EMS.HK; // 永遠有號碼
  const r = EMS[region] ? region : "HK";
  return {
    region: r,
    regionLabel: info.label,
    numbers: info.numbers.map((n) => ({ ...n })),
    universal: { ...UNIVERSAL },
    confidence,
    askLocation: confidence !== "known",
  };
}

const TEL_RE = /^[+0-9][0-9 \-()]{2,19}$/;

function sanitizeLookup(raw: unknown): { region?: string; extras: ExtraNumber[]; venue?: { name?: string; note?: string } } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const region = typeof o.region === "string" && EMS[o.region] ? o.region : undefined;
  const extras: ExtraNumber[] = [];
  if (Array.isArray(o.extras)) {
    for (const e of o.extras.slice(0, 4)) {
      if (!e || typeof e !== "object") continue;
      const label = String((e as Record<string, unknown>).label ?? "").slice(0, 40);
      const tel = String((e as Record<string, unknown>).tel ?? "").trim();
      if (label && TEL_RE.test(tel)) extras.push({ label, tel, source: "ai_search" });
    }
  }
  let venue: { name?: string; note?: string } | undefined;
  if (o.venue && typeof o.venue === "object") {
    const v = o.venue as Record<string, unknown>;
    const name = typeof v.name === "string" ? v.name.slice(0, 60) : undefined;
    const note = typeof v.note === "string" ? v.note.slice(0, 120) : undefined;
    if (name || note) venue = { name, note };
  }
  if (!region && !extras.length && !venue) return null;
  return { region, extras, venue };
}

async function runLookup(
  session: Session,
  hint: PlaceHint,
  deps: PipelineDeps,
  cfg: PipelineConfig,
  base: EmsCard,
): Promise<Action | null> {
  if (!deps.lookup) return null;
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => {
      ac.abort();
      resolve(TIMEOUT);
    }, cfg.lookupTimeoutMs);
  });
  try {
    const lookup = deps.lookup;
    const raced = await Promise.race([
      Promise.resolve().then(() => lookup({ kind: hint.kind, text: hint.text, region: hint.region }, ac.signal)),
      timeout,
    ]);
    if (raced === TIMEOUT) return null;
    const parsed = sanitizeLookup(raced);
    if (!parsed) return null;
    const region = parsed.region ?? base.region;
    const confidence = parsed.region ? "known" : base.confidence;
    const card = buildCard(region, confidence);
    if (parsed.extras.length) card.extras = parsed.extras;
    if (parsed.venue) card.venue = parsed.venue;
    if (confidence === "known") {
      session.awaitingPlace = false;
      if (session.overlay) session.overlay = { ...session.overlay, region, confidence };
    }
    return { type: "overlay_update", reason: "lookup", ems: card };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* 主流程                                                               */
/* ------------------------------------------------------------------ */

export async function processMessage(session: Session, text: string, deps: PipelineDeps): Promise<PipelineResult> {
  const cfg: PipelineConfig = { ...DEFAULT_CONFIG, ...(deps.config ?? {}) };
  session.messageCount += 1;

  // 1) 本地規則（用原文）
  const rules = deps.detectRules(text);

  // 語言同地點提示（本地）
  const lang = detectLang(text);
  if (lang !== "unknown") {
    session.langVotes[lang] = (session.langVotes[lang] ?? 0) + 1;
    session.lastLang = lang;
  }
  const hint = extractPlaceHint(text, cfg);

  const debug: Debug = {
    ruleLevel: rules.level,
    ruleIds: rules.hits.map((h) => h.id),
    judge: "skipped",
    lang: sessionLang(session),
    region: "",
    regionConfidence: "guess",
  };

  let overlayReason: OverlayReason | null = null;
  let soft = false;
  const categories = new Set<string>(rules.categories);

  if (rules.level === "high") {
    // 字面明確：即時彈，唔使等 LLM、唔使上網
    overlayReason = "rule_high";
  } else {
    // 2) 本地遮蔽 → 3) LLM 判斷（超時 + 固定格式）
    let jr: JudgeResult | null = null;
    if (deps.judge) {
      const masked = deps.maskPII(text).text;
      jr = await runJudge(deps.judge, masked, cfg.judgeTimeoutMs);
      debug.judge = jr.status;
      debug.judgeMs = jr.ms;
    }

    // 4) 合併決定 / 5) 失敗時退返去規則
    if (jr && jr.status === "ok") {
      debug.judgeLevel = jr.verdict.level;
      if (jr.verdict.category !== "none") categories.add(jr.verdict.category);
      if (jr.verdict.level === "urgent") {
        overlayReason = "llm_urgent";
      } else if (jr.verdict.level === "concern") {
        if (rules.level === "review" && cfg.reviewPlusConcernEscalates) overlayReason = "rule_review+llm_concern";
        else soft = true;
      }
    } else if (rules.level === "review") {
      overlayReason = "rule_review_llm_unavailable"; // fail-safe：寧願多報
    }
  }

  let action: Action = { type: "none" };
  let followUp: Promise<Action | null> | undefined;

  if (overlayReason) {
    const repeat = !!session.overlay;
    const { region, confidence } = inferRegion(session, deps.env, hint, cfg);
    const card = buildCard(region, confidence);
    session.overlay = { atMessage: session.messageCount, region: card.region, confidence };
    session.awaitingPlace = confidence !== "known";
    session.sinceOverlay = 0;
    if (hint) session.usedHints.push(hint.text.toLowerCase());
    action = { type: "overlay", reason: overlayReason, categories: Array.from(categories), ems: card, repeat };
    debug.region = card.region;
    debug.regionConfidence = confidence;
    // 有地點提示但本地唔認得（或者係活動）：背景查詢，唔阻住 overlay
    if (hint && (!hint.region || hint.kind === "event") && deps.lookup) {
      followUp = runLookup(session, hint, deps, cfg, card);
    }
  } else {
    if (soft) action = { type: "soft_prompt", categories: Array.from(categories) };

    // 7) overlay 之前彈過但未知地點：追蹤之後嘅訊息有冇提供地點
    if (session.overlay && session.awaitingPlace) {
      session.sinceOverlay += 1;
      if (session.sinceOverlay > cfg.awaitWindowMessages) {
        session.awaitingPlace = false;
      } else if (hint && !session.usedHints.includes(hint.text.toLowerCase())) {
        session.usedHints.push(hint.text.toLowerCase());
        const { region, confidence } = inferRegion(session, deps.env, hint, cfg);
        const card = buildCard(region, confidence);
        session.overlay = { ...session.overlay, region: card.region, confidence };
        if (confidence === "known") session.awaitingPlace = false;
        action = { type: "overlay_update", reason: "place_hint", ems: card };
        debug.region = card.region;
        debug.regionConfidence = confidence;
        if ((!hint.region || hint.kind === "event") && deps.lookup) {
          followUp = runLookup(session, hint, deps, cfg, card);
        }
      }
    }
  }

  return { action, followUp, debug };
}
