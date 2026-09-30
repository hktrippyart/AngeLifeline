/** Client + server safe — fast rule-based hard crisis before optional Gemini triage. */

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill myself|suicide|end my life|want to die|hurt myself|self[-\s]?harm)\b/i,
  /\b(overdose|od'd|can't breathe|cant breathe|not breathing|chest pain|heart attack)\b/i,
  /\b(seizure|unconscious|passed out|won't wake|vomiting blood)\b/i,
  /(自殺|想死|結束生命|傷害自己|自殘|割腕)/,
  /(過量|唔夠氣|呼吸困難|胸口痛|心臟病|抽搐|昏迷|醒唔到|嘔血|窒息|喘唔到氣|喘不到氣|透唔到氣|透不到氣)/,
];

export function normalizeCrisisInput(text: string): string {
  return text.replace(/[\u2018\u2019`´]/g, "'");
}

export function detectHardCrisis(text: string): boolean {
  const trimmed = normalizeCrisisInput(text).trim();
  if (!trimmed) return false;
  return CRISIS_PATTERNS.some((re) => re.test(trimmed));
}
