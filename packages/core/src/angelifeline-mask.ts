// angelifeline-mask.ts
// 瀏覽器／伺服器通用嘅個人資料遮蔽（冇 node 依賴）。
// 用法：喺本機先遮蔽，先將文字送去 LLM；伺服器收到之後再遮蔽一次（defense in depth）。
//
// 限制（要如實寫入文件）
// - 只遮蔽有固定格式嘅資料：電郵、香港／內地身份證、信用卡（Luhn 校驗）、電話（8 位數字或以上）。
// - 姓名、地址、工作地點、病情冇辦法靠規則攔截，所以只可以講「已移除常見個人識別資料」，唔可以講「匿名」。
// - 999、112 等短號碼唔會被遮。
// - 日期（2026-10-01）有機會被誤判做電話，屬可接受嘅誤報。

export type MaskCounts = Record<string, number>;

export const MASK_LIMITS = { maxChars: 600 };

function luhn(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

interface MaskRule {
  type: string;
  re: RegExp;
  replace: string;
  validate?: (match: string) => boolean;
}

// 次序有關：由最具體到最籠統
const MASK_RULES: MaskRule[] = [
  { type: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replace: "[email]" },
  { type: "hkid", re: /\b[A-Z]{1,2}\s?\d{6}\s?(?:\(?[0-9A]\)?)?/gi, replace: "[id]" },
  { type: "cnid", re: /\b\d{17}[\dXx]\b/g, replace: "[id]" },
  { type: "card", re: /\b(?:\d[ -]?){13,19}\b/g, replace: "[card]", validate: luhn },
  {
    type: "phone",
    re: /(?:\+|00)?\d[\d\s\-().]{6,}\d/g,
    replace: "[phone]",
    validate: (m) => m.replace(/\D/g, "").length >= 8,
  },
];

export function maskPII(input: string, opts: { maxChars?: number } = {}): { text: string; counts: MaskCounts; truncated: boolean } {
  let text = String(input ?? "").normalize("NFKC"); // 全形數字（８８８８）轉做標準形式
  const counts: MaskCounts = {};
  for (const rule of MASK_RULES) {
    text = text.replace(rule.re, (m) => {
      if (rule.validate && !rule.validate(m)) return m;
      counts[rule.type] = (counts[rule.type] ?? 0) + 1;
      return rule.replace;
    });
  }
  // 先遮蔽，後截斷（否則被截開嘅號碼可能漏出一半）；保留最近嘅內容
  const maxChars = opts.maxChars ?? MASK_LIMITS.maxChars;
  const chars = Array.from(text);
  const truncated = chars.length > maxChars;
  if (truncated) text = chars.slice(-maxChars).join("");
  return { text, counts, truncated };
}
