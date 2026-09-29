const SUICIDE_TERMS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "hurt myself",
  "self-harm",
  "self harm",
  "自殺",
  "想死",
  "結束生命",
  "傷害自己",
  "自殘",
  "割腕",
];

const MEDICAL_TERMS = [
  "heart attack",
  "suffocating",
  "can't breathe",
  "cant breathe",
  "cannot breathe",
  "overdose",
  "not breathing",
  "chest pain",
  "seizure",
  "unconscious",
  "窒息",
  "喘唔到氣",
  "喘不到氣",
  "過量",
  "唔夠氣",
  "呼吸困難",
  "胸口痛",
  "心臟病",
  "抽搐",
  "昏迷",
];

export type CrisisFocus = "suicide" | "medical" | "mixed" | "general";

export function inferCrisisFocus(text: string): CrisisFocus {
  const lower = text.toLowerCase();
  const has = (terms: string[]) =>
    terms.some((t) => lower.includes(t.toLowerCase()) || text.includes(t));

  const suicide = has(SUICIDE_TERMS);
  const medical = has(MEDICAL_TERMS);
  if (suicide && medical) return "mixed";
  if (suicide) return "suicide";
  if (medical) return "medical";
  return "general";
}

export function isSuicidalCrisis(text: string): boolean {
  const focus = inferCrisisFocus(text);
  return focus === "suicide" || focus === "mixed";
}
