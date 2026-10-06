// angelifeline-rules.ts
// 規則式危機偵測（英文、粵語、繁體／簡體中文），同分類器模型一齊用。
//
// 設計原則
// 1. 寧願多報，唔好漏報：字面明確嘅自殺／暴力／緊急醫療字眼，直接觸發 overlay，唔使問模型。
// 2. 兩個等級：
//      high   = 明確，直接觸發
//      review = 模稜兩可（例如「累到想死」「can't breathe」），要配合模型或者畀一個柔和提示
// 3. 唔返回命中嘅原文，只返回規則 id，避免日誌入面出現用戶內容。
// 4. 純函式、冇網絡、冇外部依賴，可以喺瀏覽器本地跑。
// 5. 刻意唔用 lookbehind（舊版 Safari 唔支援）。
//
// 限制（要寫入文件，唔好誇大）
// - 規則只覆蓋常見講法，間接、隱喻或者拼寫刻意扭曲嘅句子會漏，所以仍然要模型同保底電話。
// - 冇處理「k i l l」呢類逐字加空格嘅寫法。
// - 呢啲規則係初版，要用真實測試集持續檢查誤報同漏報。

export type Category = "self_harm" | "violence" | "medical";
export type Level = "high" | "review";

export interface RuleHit {
  id: string;
  category: Category;
  level: Level;
}

export interface RuleResult {
  level: "none" | Level;
  categories: Category[];
  hits: RuleHit[];
}

const MAX_LEN = 2000; // 超過就截斷，避免過長輸入拖慢

/* ------------------------------------------------------------------ */
/* 1. 正規化                                                            */
/* ------------------------------------------------------------------ */

// 簡體 → 繁體（只收規則用到嘅字）
const S2T_PAIRS =
  "杀殺|轻輕|寻尋|过過|药藥|没沒|压壓|标標|脉脈|宝寶|婴嬰|儿兒|细細|脸臉|动動|枪槍|斩斬|胁脅|说說|话話|会會|们們|个個|对對|为為|还還|愿願|难難|结結|绝絕|着著|觉覺|痉痙|挛攣|癫癲|痫癇|呛嗆|报報|导導|统統|计計|线線|闻聞|热熱|专專|题題|遗遺|书書|无無|来來|应應|识識|发發|义義|负負|离離|开開|时時|间間|脑腦|这這|门門|气氣|吗嗎|吧吧";

const S2T = new Map<string, string>(
  S2T_PAIRS.split("|").map((p) => [p[0], p[1]] as [string, string]),
);

function leet(w: string): string {
  return w.replace(/1/g, "i").replace(/0/g, "o").replace(/3/g, "e").replace(/@/g, "a").replace(/\$/g, "s");
}

export function normalizeText(input: string): string {
  let t = String(input ?? "").slice(0, MAX_LEN).normalize("NFKC").toLowerCase();
  t = t.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, ""); // 零寬字元
  t = t.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'"); // 彎引號
  t = Array.from(t, (c) => S2T.get(c) ?? c).join("");
  // 只喺含字母嘅詞入面還原 leetspeak：k1ll mys3lf → kill myself
  t = t.replace(/[a-z0-9@$]+/g, (w) => (/[a-z]/.test(w) && /[103@$]/.test(w) ? leet(w) : w));
  return t.replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/* 2. 規則工具                                                          */
/* ------------------------------------------------------------------ */

type Matcher = (t: string) => Level | null;
type Guard = (m: RegExpExecArray, t: string) => boolean;
interface Rule {
  id: string;
  category: Category;
  match: Matcher;
}

// 命中就返回 level；如果 guard 認為係日常誇張講法，就降級做 review
const rx =
  (level: Level, re: RegExp, guard?: Guard): Matcher =>
  (t) => {
    const m = re.exec(t);
    if (!m) return null;
    return guard && guard(m, t) ? "review" : level;
  };

// 全部 regex 都要命中先算
const allOf =
  (level: Level, ...res: RegExp[]): Matcher =>
  (t) =>
    res.every((r) => r.test(t)) ? level : null;

const afterMatch = (m: RegExpExecArray, t: string) => t.slice(m.index + m[0].length);
const beforeMatch = (m: RegExpExecArray, t: string) => t.slice(Math.max(0, m.index - 3), m.index);

// 「做到想死」「笑到暈咗」：前面係「到」，視為誇張（唔包括「覺得」，因為「我覺得想死」係真嘅）
const hyperboleBefore: Guard = (m, t) => /到\s*$/.test(beforeMatch(m, t));

// 「想死你」係廣東話「好掛住你」，唔係想死
const wantDieGuard: Guard = (m, t) => hyperboleBefore(m, t) || /^\s*(?:你|您|妳|佢|他|她)/.test(afterMatch(m, t));

// 「kill myself laughing」「want to die of embarrassment」
const laughAfter: Guard = (m, t) =>
  /^\s*(?:laughing|from\s+laughing|with\s+laughter|of\s+(?:embarrassment|shame|boredom|laughter|laughing)|from\s+(?:embarrassment|shame|boredom))/.test(
    afterMatch(m, t),
  );

// 新聞／討論自殺（冇第一人稱）唔當緊急
const newsContext: Guard = (_m, t) => !/我|自己|\bi\b/.test(t) && /防治|自殺率|新聞|報道|報導|統計|專題|預防/.test(t);

// 「殺死我嘅時間」「殺死我心情」呢類
const idiomAfterZh: Guard = (m, t) =>
  /^\s*(?:嘅|的)?(?:時間|細胞|腦細胞|心情|興致)/.test(afterMatch(m, t)) || hyperboleBefore(m, t);

const BREATH_HYPERBOLE: Guard = (m, t) => /[笑跑行爬急]到\s*$/.test(beforeMatch(m, t));

/* ------------------------------------------------------------------ */
/* 3. 規則                                                              */
/* ------------------------------------------------------------------ */

const INFANT_ZH = /(?:bb|baby|嬰兒|嬰孩|寶寶|細路|細佬仔|細路哥|小孩|孩子|囡囡|個仔|新生兒|初生)/;
const URGENT_ZH =
  /(?:透唔到氣|喘唔到氣|唔識呼吸|冇呼吸|沒呼吸|沒有呼吸|面青|臉青|口唇紫|嘴唇紫|嘴唇發紫|口唇發紫|濁親|哽親|嗆到|窒息|抽搐|抽(?:緊)?筋|唔郁|不動|叫唔醒|叫不醒|冇反應|沒反應|面色發灰|發灰)/;

const CHOKE_ZH = /(?:噎住|嗆住|嗆到|哽住|哽親|濁親|濁住|塞住(?:咗)?喉嚨|喉嚨(?:卡|塞)住)/;
const CHOKE_SEVERE_ZH = /(?:透唔到氣|喘唔到氣|講唔到嘢|說不出話|發不出聲|面(?:青|紫|紅)|臉(?:青|紫)|口唇紫|嘴唇紫)/;

export const RULES: Rule[] = [
  /* ============ 自傷：英文 ============ */
  {
    id: "en.kill_self",
    category: "self_harm",
    match: rx("high", /\bkill(?:ing)?\s+(?:my\s?self|myself|him\s?self|her\s?self|them\s?selves?|themself)\b/, laughAfter),
  },
  {
    id: "en.end_life",
    category: "self_harm",
    match: rx("high", /\b(?:end(?:ing)?|take|taking)\s+(?:my|his|her|their)\s+(?:own\s+)?life\b|\bend\s+it\s+all\b/),
  },
  {
    id: "en.want_die",
    category: "self_harm",
    match: rx(
      "high",
      /\b(?:want(?:s|ed)?|wanna)\s+(?:to\s+)?die\b|\bwish(?:es|ed)?\s+(?:i|he|she|they)\s+(?:was|were)\s+dead\b|\b(?:want|wanna)\s+to\s+be\s+dead\b/,
      laughAfter,
    ),
  },
  {
    id: "en.never_wake",
    category: "self_harm",
    match: rx("high", /\b(?:wish|want|hope|wanna)\b.{0,40}\bnever\s+wake\s+up\b/),
  },
  {
    id: "en.dont_want_live",
    category: "self_harm",
    match: rx(
      "high",
      /\b(?:don'?t|do\s+not|no\s+longer|not)\s+want\s+to\s+(?:live|be\s+alive|exist|go\s+on)\b|\bnothing\s+(?:left\s+)?to\s+live\s+for\b|\bbetter\s+off\s+(?:dead|without\s+me)\b|\b(?:no|any)\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|going\s+on|being\s+alive|continu(?:e|ing))\b|\btired\s+of\s+being\s+alive\b|\bdon'?t\s+see\s+(?:the|a)\s+(?:point|reason)\s+(?:in|to|of)\s+(?:going\s+on|living|life)\b/,
    ),
  },
  {
    id: "en.better_gone",
    category: "self_harm",
    match: rx(
      "high",
      /\b(?:fine|better|happier|okay|ok)\s+(?:if|when)\s+i\s+(?:were|was|am)\s+(?:gone|dead|not\s+here|not\s+around)\b|\b(?:nobody|no\s+one)\s+would\s+(?:notice|care|miss)\s+(?:if|when)\s+i\s+(?:were|was)\s+(?:gone|dead)\b/,
    ),
  },
  {
    id: "en.suicide_intent",
    category: "self_harm",
    match: rx(
      "high",
      /\b(?:commit(?:ting)?|attempt(?:ing|ed)?|thinking\s+(?:of|about)|planning|considering|contemplating)\s+suicide\b|\bsuicidal\b|\bsuicide\s+(?:plan|note|attempt)\b/,
    ),
  },
  { id: "en.suicide_word", category: "self_harm", match: rx("review", /\bsuicide\b/) },
  { id: "en.unalive", category: "self_harm", match: rx("high", /\bunalive(?:d)?\s+(?:my\s?self|myself|me)\b/) },
  { id: "en.slang_kms", category: "self_harm", match: rx("review", /\bkms\b/) },
  {
    id: "en.self_harm",
    category: "self_harm",
    match: rx("review", /\b(?:hurt|harm|cut)(?:ting)?\s+(?:my\s?self|myself)\b|\bself[- ]?harm\b/),
  },
  {
    id: "en.want_disappear",
    category: "self_harm",
    match: rx(
      "review",
      /\bwant(?:s|ed)?\s+(?:to\s+)?disappear\b|\bwish\s+i\s+(?:could\s+)?disappear\b|\bcan'?t\s+(?:go\s+on|do\s+this\s+anymore|keep\s+(?:doing|going))\b/,
    ),
  },
  {
    id: "en.dont_want_here",
    category: "self_harm",
    match: rx("review", /\b(?:don'?t|do\s+not)\s+want\s+to\s+be\s+here\s+(?:anymore|any\s+more)\b/),
  },

  /* ============ 自傷：中文（粵語／繁體／簡體） ============ */
  {
    id: "zh.suicide_words",
    category: "self_harm",
    match: rx("high", /輕生|尋死|自殺|自盡|尋短見|了結自己|結束(?:自己)?(?:嘅|的)?生命|結束自己/, newsContext),
  },
  {
    id: "zh.want_die",
    category: "self_harm",
    match: rx("high", /(?:好?想|只想|就想|諗住|打算|準備|決定)\s*(?:去|返)?\s*(?:死|一死了之|了斷)/, wantDieGuard),
  },
  {
    id: "zh.not_want_live",
    category: "self_harm",
    match: rx("high", /(?:唔|不|冇|沒)(?:想|願意|願|肯)(?:再)?(?:活|生存|做人)/, hyperboleBefore),
  },
  { id: "zh.dont_wake", category: "self_harm", match: rx("high", /(?:唔|不)想再醒/) },
  {
    id: "zh.better_without",
    category: "self_harm",
    match: rx("high", /(?:冇|沒有?)(?:咗|了|左)?我.{0,10}(?:好啲|更好|好些|好過|過得更好|會好)/),
  },
  {
    id: "zh.better_dead",
    category: "self_harm",
    match: rx("high", /(?:死咗|死左|死了|死掉|死去).{0,4}(?:會|就|應該|可能)?(?:好啲|更好|好些|好過|輕鬆|解脫|冇咁痛苦)/, hyperboleBefore),
  },
  { id: "zh.note", category: "self_harm", match: rx("high", /遺書|遺言/) },
  {
    id: "zh.if_i_died",
    category: "self_harm",
    match: rx("review", /(?:如果|若|萬一)我(?:死咗|死了|死左|走咗|不在了|消失).{0,10}(?:冇人|沒人|不會有人|無人)/),
  },
  {
    id: "zh.hopeless",
    category: "self_harm",
    match: rx(
      "review",
      /(?:活(?:住|著|落去|下去))(?:真係|真的|好|很)?(?:辛苦|痛苦|攰|累|冇意義|沒有?意義)|(?:撐|捱|頂)(?:唔|不)(?:落去|下去|住|到)|想(?:消失|解脫|放棄一切|一了百了)|一了百了|一次過解脫/,
    ),
  },

  /* ============ 暴力 ============ */
  {
    id: "en.trying_kill",
    category: "violence",
    match: rx("high", /\b(?:trying|tries|tried|attempt(?:ing|ed)?)\s+to\s+(?:kill|murder|stab|shoot|strangle)\s+(?:me|her|him|us|them)\b/),
  },
  {
    id: "en.weapon_threat",
    category: "violence",
    match: allOf("high", /\b(?:knife|gun|weapon|blade|machete)\b/, /\b(?:kill|stab|shoot|hurt|threat(?:en|ened|ening)?|attack(?:ing|ed)?)\b/),
  },
  {
    id: "en.going_to_kill_other",
    category: "violence",
    match: rx("high", /\b(?:going|gonna|will|wants?)\s+(?:to\s+)?kill\s+(?:her|him|them|us)\b/),
  },
  {
    id: "en.going_to_kill_me",
    category: "violence",
    match: rx("review", /\b(?:going|gonna|will|wants?)\s+(?:to\s+)?kill\s+(?:me|you)\b/), // "my boss is going to kill me" 常見
  },
  { id: "en.stabbed", category: "violence", match: rx("high", /\b(?:stabbed|shot\s+(?:in|at)|gunshot)\b/) },
  {
    id: "zh.threat_kill",
    category: "violence",
    match: rx(
      "high",
      /(?:要|話要|說要|揚言|威脅(?:要)?|想|打算|準備)\s*(?:殺|斬|砍|打死|整死|搞死)(?:死|咗|了)?\s*(?:我|你|佢|他|她|大家|屋企人|你哋|你們)/,
      idiomAfterZh,
    ),
  },
  {
    id: "zh.weapon_threat",
    category: "violence",
    match: allOf("high", /(?:拎|持|揸|握|帶住|舉住|有)(?:住|著)?.{0,2}(?:刀|槍|斧|棍|武器)/, /(?:殺|斬|砍|打|傷害|追|威脅|嚇)/),
  },
  {
    id: "zh.stabbed",
    category: "violence",
    match: rx("high", /(?:被|俾)(?:人)?(?:斬|刺|砍|槍擊|開槍)|中(?:咗|了)?刀/),
  },

  /* ============ 緊急醫療：英文 ============ */
  {
    id: "en.not_breathing",
    category: "medical",
    match: rx("high", /\b(?:not|isn'?t|aren'?t|stopped|stop(?:ped)?|no\s+longer)\s+breath(?:ing|e)\b/),
  },
  { id: "en.cant_breathe", category: "medical", match: rx("review", /\b(?:can'?t|cannot|couldn'?t)\s+breathe\b/) }, // "laughed so hard I couldn't breathe"
  {
    id: "en.unresponsive",
    category: "medical",
    match: rx("high", /\b(?:unconscious|unresponsive|no\s+pulse|won'?t\s+wake\s+up|not\s+waking\s+up|can'?t\s+wake\s+(?:him|her|them|me)\s+up)\b/),
  },
  { id: "en.choking", category: "medical", match: rx("high", /\bchoking\b|\bchoked\s+on\b/) },
  { id: "en.seizure", category: "medical", match: rx("high", /\bseiz(?:ure|ures|ing)\b|\bconvuls(?:ion|ions|ing)\b/) },
  {
    id: "en.blue",
    category: "medical",
    match: rx("high", /\b(?:turning|turned|going)\s+blue\b|\bblue\s+(?:lips|face)\b|\blips\s+(?:are|were)\s+(?:turning\s+)?blue\b/),
  },
  {
    id: "en.chest_pain",
    category: "medical",
    match: allOf(
      "high",
      /\bchest\s+(?:pain|tightness|is\s+(?:crushing|tight))|\bcrushing\s+chest|\bpain\s+in\s+(?:my|his|her)\s+chest\b/,
      /\b(?:sweat|sweating|short\s+of\s+breath|arm|jaw|dizzy)\b/,
    ),
  },
  {
    id: "en.overdose",
    category: "medical",
    match: rx(
      "high",
      /\boverdos(?:e|ed|ing)|\bod'?(?:d|ed)\b|\bod(?=咗|左|了)|\b(?:took|swallowed|ate|taken)\s+(?:too\s+many|a\s+lot\s+of|a\s+whole\s+bunch\s+of|the\s+whole\s+bottle\s+of|way\s+too\s+(?:many|much))\s+(?:pills|tablets|meds|medication|painkillers|sleeping)/,
    ),
  },
  {
    id: "en.infant_emergency",
    category: "medical",
    match: allOf(
      "high",
      /\b(?:baby|newborn|infant|toddler)\b/,
      /\b(?:choking|blue|limp|not\s+breathing|isn'?t\s+breathing|won'?t\s+wake|convuls|seiz|unresponsive|struggling\s+to\s+breathe|can'?t\s+breathe)/,
    ),
  },
  { id: "en.collapsed", category: "medical", match: rx("review", /\bcollaps(?:e|ed|ing)\b/) },

  /* ============ 緊急醫療：中文 ============ */
  {
    id: "zh.not_breathing",
    category: "medical",
    match: rx("high", /(?:冇|沒有?|停咗|停了|停止|失去)(?:咗|了|左)?(?:呼吸|心跳|脈搏)|唔識呼吸/),
  },
  {
    id: "zh.unresponsive",
    category: "medical",
    match: rx(
      "high",
      /昏迷|不省人事|失去(?:知覺|意識)|冇(?:知覺|意識|反應)|(?:叫|喚|推|搖)(?:極都|極|落去|了很久)?(?:都)?(?:唔|不|冇|沒)(?:醒|反應|郁|動)/,
    ),
  },
  { id: "zh.faint", category: "medical", match: rx("high", /暈(?:低|倒|咗|了|過去)|昏倒|暈厥|倒地|突然倒/, hyperboleBefore) },
  { id: "zh.seizure", category: "medical", match: rx("high", /抽搐|痙攣|癲癇|發羊吊|羊癲瘋|眼反白|眼上吊|眼睛上吊/) },
  { id: "zh.cramp", category: "medical", match: rx("review", /抽筋/) }, // 廣東話「抽筋」多數係腳抽筋
  {
    id: "zh.choking",
    category: "medical",
    match: (t) => {
      if (/窒息/.test(t)) return /[到得]\s*窒息/.test(t) ? "review" : "high";
      if (CHOKE_ZH.test(t)) return CHOKE_SEVERE_ZH.test(t) ? "high" : "review"; // 飲水濁親多數冇事
      return null;
    },
  },
  {
    id: "zh.cant_breathe",
    category: "medical",
    match: rx("high", /(?:透|喘|呼吸)(?:唔|不)(?:到|過)?氣|呼吸(?:困難|唔順|急促)|喘不過氣|透不過氣/, BREATH_HYPERBOLE),
  },
  {
    id: "zh.chest",
    category: "medical",
    match: allOf(
      "high",
      /(?:心口|胸口|胸)(?:好|非常|劇烈|很)?(?:痛|悶|壓住|壓著|似石)/,
      /冷汗|標汗|手臂麻|左手麻|透唔到氣|喘不過氣|面青|面色(?:蒼白|灰)|口唇(?:發)?白/,
    ),
  },
  { id: "zh.infant_emergency", category: "medical", match: allOf("high", INFANT_ZH, URGENT_ZH) },
  {
    id: "zh.overdose",
    category: "medical",
    match: rx(
      "high",
      /(?:食|吞|服|飲)(?:咗|了|左)?(?:過量|大量|好多|一堆|太多|成樽|整樽|成瓶|整瓶|一大把)(?:嘅|的)?(?:藥|藥丸|安眠藥|止痛藥|藥物)|服藥過量|藥物過量|過量服藥/,
    ),
  },
  {
    id: "zh.bleeding",
    category: "medical",
    match: rx("review", /流(?:好多|很多|大量|成地)血/),
  },
];

/* ------------------------------------------------------------------ */
/* 4. 偵測                                                              */
/* ------------------------------------------------------------------ */

export function detectRules(input: string): RuleResult {
  const t = normalizeText(input);
  const hits: RuleHit[] = [];
  if (t) {
    for (const r of RULES) {
      let level: Level | null = null;
      try {
        level = r.match(t);
      } catch {
        level = null; // 單一規則出錯唔可以影響其他規則
      }
      if (level) hits.push({ id: r.id, category: r.category, level });
    }
  }
  const high = hits.some((h) => h.level === "high");
  const categories = Array.from(new Set(hits.map((h) => h.category)));
  return { level: high ? "high" : hits.length ? "review" : "none", categories, hits };
}

/* ------------------------------------------------------------------ */
/* 5. 同模型合併                                                         */
/* ------------------------------------------------------------------ */

export interface DecideOptions {
  threshold?: number; // 模型機率達到呢個值就觸發（預設 0.3）
  reviewThreshold?: number; // review 規則 + 模型機率達到呢個值就觸發（預設 0.02）
}

export interface Decision {
  trigger: boolean; // 要唔要彈出 overlay
  softPrompt: boolean; // 未觸發，但值得畀一個柔和嘅「需要支援？」提示
  reason: "rule_high" | "model" | "rule_review+model" | "rule_review_model_unavailable" | "none";
  categories: Category[];
  ruleIds: string[]; // 安全：只有規則 id，冇用戶原文
}

/**
 * modelProb：模型嘅危機機率；模型失敗、超時或者唔可用時傳 null／undefined。
 * 模型唔可用時，有任何規則命中（包括 review）都觸發，寧願多報。
 */
export function decide(rules: RuleResult, modelProb?: number | null, opts: DecideOptions = {}): Decision {
  const threshold = opts.threshold ?? 0.3;
  const reviewThreshold = opts.reviewThreshold ?? 0.02;
  const base = { categories: rules.categories, ruleIds: rules.hits.map((h) => h.id) };

  if (rules.level === "high") return { trigger: true, softPrompt: false, reason: "rule_high", ...base };

  const hasModel = typeof modelProb === "number" && Number.isFinite(modelProb);
  if (!hasModel) {
    if (rules.level === "review") {
      return { trigger: true, softPrompt: false, reason: "rule_review_model_unavailable", ...base };
    }
    return { trigger: false, softPrompt: false, reason: "none", ...base };
  }

  const p = modelProb as number;
  if (p >= threshold) return { trigger: true, softPrompt: false, reason: "model", ...base };
  if (rules.level === "review" && p >= reviewThreshold) {
    return { trigger: true, softPrompt: false, reason: "rule_review+model", ...base };
  }
  return { trigger: false, softPrompt: rules.level === "review", reason: "none", ...base };
}

/** 方便用：一步完成 */
export function checkMessage(text: string, modelProb?: number | null, opts?: DecideOptions): Decision {
  return decide(detectRules(text), modelProb, opts);
}
