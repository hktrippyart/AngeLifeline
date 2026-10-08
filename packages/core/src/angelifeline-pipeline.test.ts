// 執行：node --experimental-strip-types --no-warnings --test angelifeline-pipeline.test.ts
// （Node 22.6 或以上；Node 23.6+ 唔使加 flag。用 vitest／jest 嘅話，將頭兩行 import 改成對應嘅 API。）
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRules } from "./angelifeline-rules";
import { maskPII } from "./angelifeline-mask";
import {
  createSession, processMessage, detectLang, extractPlaceHint, regionFromTimezone, regionFromLocale,
  createHttpJudge, parseVerdict, buildCard, EMS,
} from "./angelifeline-pipeline";
import type { Judge, Lookup, PipelineDeps } from "./angelifeline-pipeline";

const base = (extra: Partial<PipelineDeps> = {}): PipelineDeps => ({ detectRules, maskPII, ...extra });
const counter = () => ({ n: 0, args: [] as string[] });
const judgeOf = (level: string, c = counter(), category = "self_harm"): { judge: Judge; c: ReturnType<typeof counter> } => ({
  c,
  judge: async (text) => { c.n += 1; c.args.push(text); return { level, category }; },
});
const never: Judge = () => new Promise(() => {}); // 永遠唔返

/* ---------- 1. 規則先行，唔使等 LLM ---------- */
test("規則 high：即時 overlay，LLM 完全唔會被叫", async () => {
  const j = judgeOf("none");
  const r = await processMessage(createSession(), "I want to kill myself", base({ judge: j.judge }));
  assert.equal(r.action.type, "overlay");
  assert.equal(r.action.type === "overlay" && r.action.reason, "rule_high");
  assert.equal(j.c.n, 0);
  assert.equal(r.debug.judge, "skipped");
});

test("LLM 唔可以取消規則 high（就算 LLM 話冇事）", async () => {
  const j = judgeOf("none");
  const r = await processMessage(createSession(), "我真係好想死", base({ judge: j.judge }));
  assert.equal(r.action.type, "overlay");
});

/* ---------- 2. 遮蔽 ---------- */
test("LLM 只收到遮蔽後嘅文字", async () => {
  const j = judgeOf("none");
  await processMessage(createSession(), "my number is 91234567, I feel odd tonight", base({ judge: j.judge }));
  assert.equal(j.c.n, 1);
  assert.ok(j.c.args[0].includes("[phone]"));
  assert.ok(!j.c.args[0].includes("91234567"));
});

/* ---------- 3. 合併決定 ---------- */
test("LLM urgent → overlay", async () => {
  const r = await processMessage(createSession(), "我想從這個世界消失，大家都唔會留意", base({ judge: judgeOf("urgent").judge }));
  assert.equal(r.action.type, "overlay");
  assert.equal(r.action.type === "overlay" && r.action.reason, "llm_urgent");
});

test("LLM concern → 柔和提示（唔係 overlay）", async () => {
  const r = await processMessage(createSession(), "今日好攰，好冇動力", base({ judge: judgeOf("concern").judge }));
  assert.equal(r.action.type, "soft_prompt");
});

test("規則 review + LLM concern → overlay（可以用 config 關閉）", async () => {
  const r1 = await processMessage(createSession(), "做功課做到想死", base({ judge: judgeOf("concern").judge }));
  assert.equal(r1.action.type, "overlay");
  const r2 = await processMessage(createSession(), "做功課做到想死", base({ judge: judgeOf("concern").judge, config: { reviewPlusConcernEscalates: false } }));
  assert.equal(r2.action.type, "soft_prompt");
});

test("規則 review + LLM 話冇事 → 冇事（LLM 睇到語境）", async () => {
  const r = await processMessage(createSession(), "做功課做到想死", base({ judge: judgeOf("none").judge }));
  assert.equal(r.action.type, "none");
});

/* ---------- 4. 失敗、超時、被擋、空白 ---------- */
test("LLM 超時：用規則；冇規則命中就冇動作，唔會死等", async () => {
  const t0 = Date.now();
  const r = await processMessage(createSession(), "今日天氣好好", base({ judge: never, config: { judgeTimeoutMs: 40 } }));
  assert.equal(r.debug.judge, "timeout");
  assert.equal(r.action.type, "none");
  assert.ok(Date.now() - t0 < 1000);
});

test("LLM 超時 + 規則 review → fail-safe overlay", async () => {
  const r = await processMessage(createSession(), "做功課做到想死", base({ judge: never, config: { judgeTimeoutMs: 40 } }));
  assert.equal(r.action.type, "overlay");
  assert.equal(r.action.type === "overlay" && r.action.reason, "rule_review_llm_unavailable");
  assert.ok(r.action.type === "overlay" && r.action.ems.numbers.length > 0);
});

test("LLM 報錯／格式錯／被擋／空白，全部當不可用", async () => {
  const cases: [string, Judge][] = [
    ["error", async () => { throw new Error("boom"); }],
    ["invalid", async () => ({ level: "maybe" })],
    ["invalid", async () => "唔係 JSON"],
    ["blocked", async () => null],
    ["blocked", async () => ""],
  ];
  for (const [expected, judge] of cases) {
    const r = await processMessage(createSession(), "做功課做到想死", base({ judge }));
    assert.equal(r.debug.judge, expected);
    assert.equal(r.action.type, "overlay"); // review + 不可用 → fail-safe
  }
});

test("冇配置 LLM：只用規則", async () => {
  const r = await processMessage(createSession(), "今日天氣好好", base());
  assert.equal(r.action.type, "none");
  const r2 = await processMessage(createSession(), "I want to kill myself", base());
  assert.equal(r2.action.type, "overlay");
});

/* ---------- 5. 緊急電話按地區 ---------- */
test("冇地點提示：按語言／時區／瀏覽器語言揀，永遠有號碼", async () => {
  const hk = await processMessage(createSession(), "我想殺死自己，佢哋都唔會知", base());
  assert.equal(hk.action.type === "overlay" && hk.action.ems.numbers[0].tel, "999");
  assert.equal(hk.action.type === "overlay" && hk.action.ems.confidence, "guess");
  assert.equal(hk.action.type === "overlay" && hk.action.ems.askLocation, true);

  const tw = await processMessage(createSession(), "I want to kill myself", base({ env: { timezone: "Asia/Taipei" } }));
  assert.equal(tw.action.type === "overlay" && tw.action.ems.region, "TW");
  assert.equal(tw.action.type === "overlay" && tw.action.ems.numbers[0].tel, "119");

  const gb = await processMessage(createSession(), "I want to kill myself", base({ env: { locale: "en-GB" } }));
  assert.equal(gb.action.type === "overlay" && gb.action.ems.region, "GB");

  const bad = await processMessage(createSession(), "I want to kill myself", base({ config: { siteRegion: "XX" } }));
  assert.ok(bad.action.type === "overlay" && bad.action.ems.numbers.length > 0);
});

test("訊息已經有地點提示：直接用，confidence = known", async () => {
  const r = await processMessage(createSession(), "I want to kill myself, I'm in Taipei", base());
  assert.equal(r.action.type === "overlay" && r.action.ems.region, "TW");
  assert.equal(r.action.type === "overlay" && r.action.ems.confidence, "known");
  assert.equal(r.action.type === "overlay" && r.action.ems.askLocation, false);
});

/* ---------- 6. Overlay 之後追蹤地點 ---------- */
test("Overlay 未知地點 → 之後用戶講咗地點 → 更新 overlay（只更新一次）", async () => {
  const s = createSession();
  const j = judgeOf("none").judge;
  const r1 = await processMessage(s, "I want to kill myself", base({ judge: j }));
  assert.equal(r1.action.type, "overlay");
  assert.equal(s.awaitingPlace, true);

  const r2 = await processMessage(s, "I'm in Taipei", base({ judge: j }));
  assert.equal(r2.action.type, "overlay_update");
  assert.equal(r2.action.type === "overlay_update" && r2.action.ems.region, "TW");
  assert.equal(r2.action.type === "overlay_update" && r2.action.ems.confidence, "known");
  assert.equal(s.awaitingPlace, false);

  const r3 = await processMessage(s, "I'm in Taipei", base({ judge: j }));
  assert.equal(r3.action.type, "none");
});

test("追蹤有期限：過咗幾句就唔再更新", async () => {
  const s = createSession();
  const j = judgeOf("none").judge;
  await processMessage(s, "我想死", base({ judge: j }));
  for (let i = 0; i < 7; i++) await processMessage(s, "ok", base({ judge: j }));
  const r = await processMessage(s, "我喺灣仔", base({ judge: j }));
  assert.equal(r.action.type, "none");
});

test("冇 overlay 之前，地點提示唔會觸發更新", async () => {
  const r = await processMessage(createSession(), "我喺灣仔", base({ judge: judgeOf("none").judge }));
  assert.equal(r.action.type, "none");
});

test("重複觸發 overlay：標記 repeat", async () => {
  const s = createSession();
  const a = await processMessage(s, "I want to kill myself", base());
  const b = await processMessage(s, "I want to kill myself", base());
  assert.equal(a.action.type === "overlay" && a.action.repeat, false);
  assert.equal(b.action.type === "overlay" && b.action.repeat, true);
});

/* ---------- 7. 地點查詢（AI 搜尋）---------- */
test("本地唔認得嘅活動：overlay 即時彈，查詢喺背景做，只送地點提示", async () => {
  let received: unknown = null;
  const lookup: Lookup = async (input) => {
    received = input;
    return { extras: [{ label: "場地醫療站", tel: "+852 1234 5678" }], venue: { name: "Clockenflap", note: "請核實" } };
  };
  const r = await processMessage(createSession(), "我喺 Clockenflap Festival 呢度，我朋友冇呼吸", base({ lookup }));
  assert.equal(r.action.type, "overlay"); // 即時
  assert.ok(r.followUp);
  const up = await r.followUp;
  assert.equal(up?.type, "overlay_update");
  assert.equal(up?.type === "overlay_update" && up.ems.extras?.[0].source, "ai_search");
  assert.equal(up?.type === "overlay_update" && up.ems.numbers[0].tel, "999"); // 緊急電話仍然係靜態表
  assert.equal(JSON.stringify(received).includes("朋友"), false); // 冇洩漏整段對話
  assert.equal((received as { text: string }).text, "Clockenflap Festival");
});

test("AI 搜尋回傳唔合格嘅電話／地區：全部忽略，唔會取代靜態緊急電話", async () => {
  const lookup: Lookup = async () => ({ region: "ZZ", extras: [{ label: "x", tel: "call me maybe" }, { label: "", tel: "123" }] });
  const r = await processMessage(createSession(), "我喺 Clockenflap Festival 呢度，我朋友冇呼吸", base({ lookup }));
  assert.equal(await r.followUp, null);
  assert.ok(r.action.type === "overlay" && r.action.ems.numbers.length > 0);
});

test("地點查詢超時／報錯：followUp 係 null，overlay 唔受影響", async () => {
  const slow: Lookup = () => new Promise(() => {});
  const r1 = await processMessage(createSession(), "我喺 Clockenflap Festival 呢度，我朋友冇呼吸", base({ lookup: slow, config: { lookupTimeoutMs: 40 } }));
  assert.equal(r1.action.type, "overlay");
  assert.equal(await r1.followUp, null);
  const bad: Lookup = async () => { throw new Error("x"); };
  const r2 = await processMessage(createSession(), "我喺 Clockenflap Festival 呢度，我朋友冇呼吸", base({ lookup: bad }));
  assert.equal(await r2.followUp, null);
});

test("Lookup 返回已知地區 → overlay 更新做 known，並停止追蹤", async () => {
  const s = createSession();
  const lookup: Lookup = async () => ({ region: "MO" });
  const r = await processMessage(s, "我喺 Zero Club 呢度，我朋友冇呼吸", base({ lookup }));
  const up = await r.followUp;
  assert.equal(up?.type === "overlay_update" && up.ems.region, "MO");
  assert.equal(up?.type === "overlay_update" && up.ems.confidence, "known");
  assert.equal(s.awaitingPlace, false);
});

/* ---------- 8. 其他 ---------- */
test("debug 資訊冇用戶原文", async () => {
  const text = "我今晚想殺死自己，秘密係 abc123xyz";
  const r = await processMessage(createSession(), text, base({ judge: judgeOf("none").judge }));
  assert.equal(JSON.stringify(r.debug).includes("abc123xyz"), false);
});

test("語言偵測、地區推斷、地點提示抽取", () => {
  assert.equal(detectLang("我唔知點算，佢冇反應"), "yue");
  assert.equal(detectLang("我觉得没有希望"), "zh-Hans");
  assert.equal(detectLang("我覺得沒有希望"), "zh-Hant");
  assert.equal(detectLang("please help me"), "en");
  assert.equal(detectLang("ok"), "unknown");
  assert.equal(regionFromTimezone("Asia/Hong_Kong"), "HK");
  assert.equal(regionFromTimezone("Australia/Sydney"), "AU");
  assert.equal(regionFromTimezone("America/Toronto"), "CA");
  assert.equal(regionFromLocale("zh-HK"), "HK");
  assert.equal(regionFromLocale("en-US"), "US");
  assert.equal(extractPlaceHint("我喺灣仔")?.region, "HK");
  assert.equal(extractPlaceHint("I'm at Zero Club")?.kind, "phrase");
  assert.equal(extractPlaceHint("I'm in pain"), null);
  assert.equal(extractPlaceHint("I'm in the toilet"), null);
  assert.equal(extractPlaceHint("我喺屋企"), null);
  assert.equal(extractPlaceHint("我喺碧瑤灣酒吧")?.kind, "phrase");
  assert.equal(extractPlaceHint("see you at Fire Fest", { knownEvents: [{ name: "Fire Fest", region: "AU" }] })?.region, "AU");
});

test("parseVerdict 嚴格驗證；buildCard 永遠有號碼", () => {
  assert.equal(parseVerdict('{"level":"urgent","category":"self_harm"}')?.level, "urgent");
  assert.equal(parseVerdict('前言 {"level":"none","category":"x"} 後語')?.category, "other");
  assert.equal(parseVerdict({ level: "URGENT" })?.level, "urgent");
  assert.equal(parseVerdict({ level: "high" }), null);
  assert.equal(parseVerdict(null), null);
  for (const k of Object.keys(EMS)) assert.ok(buildCard(k, "guess").numbers.length > 0);
  assert.ok(buildCard("nope", "guess").numbers.length > 0);
});

test("createHttpJudge：成功、非 2xx、被擋", async () => {
  const mk = (res: { ok: boolean; status?: number; json?: unknown }) =>
    (async () => ({ ok: res.ok, status: res.status ?? 200, json: async () => res.json })) as unknown as typeof fetch;
  const sig = new AbortController().signal;
  assert.deepEqual(await createHttpJudge("/x", mk({ ok: true, json: { level: "none" } }))("t", sig), { level: "none" });
  await assert.rejects(createHttpJudge("/x", mk({ ok: false, status: 502 }))("t", sig));
  assert.equal(await createHttpJudge("/x", mk({ ok: true, json: { blocked: true } }))("t", sig), null);
});
