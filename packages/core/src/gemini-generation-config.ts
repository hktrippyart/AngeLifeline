/**
 * Gemini API forward-compat: upcoming models reject temperature / top_p / top_k
 * and thinking_budget (use thinking_level instead). See Google Gemini release notes.
 */
export function geminiModelRejectsSamplingParams(model: string): boolean {
  const m = model.trim().toLowerCase();
  return /^gemini-3(?:[.-]|$)/.test(m);
}

type GenConfig = Record<string, unknown>;

/** Strip fields that upcoming Gemini models reject; safe for older models too. */
export function sanitizeGeminiGenerationConfig(
  model: string,
  config: GenConfig,
): GenConfig {
  const out: GenConfig = { ...config };

  if (geminiModelRejectsSamplingParams(model)) {
    delete out.temperature;
    delete out.topP;
    delete out.topK;
    delete out.top_p;
    delete out.top_k;
  }

  const thinking = out.thinkingConfig;
  if (thinking && typeof thinking === "object") {
    const tc = { ...(thinking as GenConfig) };
    delete tc.thinkingBudget;
    delete tc.thinking_budget;
    if (Object.keys(tc).length === 0) delete out.thinkingConfig;
    else out.thinkingConfig = tc;
  }

  return out;
}
