// 執行：node --experimental-strip-types --test angelifeline-rules.test.ts   （Node 22.6 或以上；Node 23.6+ 唔使加 flag）
// 如果用 vitest／jest：將頭兩行 import 改成對應嘅 describe/it/expect，邏輯唔使改。
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRules, decide, checkMessage, normalizeText } from "./angelifeline-rules";

const level = (s: string) => detectRules(s).level;

// 一定要 high（真正危機）
const MUST_HIGH: string[] = [
  // v4–v6 模型漏咗嘅
  "我今晚就想去死,",
  "我覺得死咗會好啲",
  "我真係好想死",
  "佢拎刀話要殺死我",
  "個BB濁親，透唔到氣",
  "佢心口痛到標冷汗",
  // 自傷（英文）
  "I'm planning to kill myself this weekend",
  "I'm thinking about killing myself tonight",
  "I want to kill myself",
  "I'm going to end my life tonight",
  "I wish I could go to sleep and never wake up",
  "My friend just told me she wants to die and she's not answering",
  "I keep thinking everyone would be better off without me",
  "Everyone would be fine if I were gone",
  "I have nothing left to live for",
  "I'm so tired of being alive",
  // 自傷（中文）
  "我今晚不想再醒來",
  "我唔想再醒返",
  "我覺得沒有我，大家會過得更好",
  "我覺得自己係個負累，冇咗我大家會好啲",
  "我已经寫好遗书了",
  "我想自杀",
  "我朋友話佢想自殺，而家唔接我電話",
  "我唔想再活落去",
  // 寫法變化
  "k1ll mys3lf",
  "ｋｉｌｌ ｍｙｓｅｌｆ",
  "ki\u200Bll myself",
  // 暴力
  "有人拎刀追住我，話要殺咗我",
  "He's been stabbed and is bleeding badly",
  "Someone is trying to kill me, please send police",
  "He said he's going to kill her, and he has a knife",
  // 緊急醫療
  "My baby is choking and turning blue",
  "The baby isn't breathing, please help",
  "BB seizure 緊，成身震，眼反白",
  "我個friend OD咗，而家冇反應",
  "佢好似 overdose 咗，叫唔醒",
  "老公話胸口好似石壓住，手臂麻，標冷汗",
  "阿媽突然心口痛，標晒冷汗，面青口唇白",
  "我阿爺哽親，塞住喉嚨，講唔到嘢",
  "佢突然濁親，面紅晒，講唔到嘢",
  "She took too many pills and won't wake up",
  "I found him not breathing and he looks dead",
  "我朋友暈咗，叫極都唔醒",
];

// 絕對唔可以 high（日常誇張講法、冇事）
const MUST_NOT_HIGH: string[] = [
  "笑死我，你睇吓呢段影片",
  "餓死我喇，我哋食飯啦",
  "熱死我喇，要即刻開冷氣",
  "累死我了，回家直接睡",
  "手機死機了",
  "今晚玩到死",
  "做功課做到想死",
  "笑到想死",
  "我好想死你呀",
  "He killed it on stage tonight",
  "I'm dying of boredom here",
  "This traffic is killing me",
  "That joke killed me",
  "I could kill for a slice of pizza right now",
  "He murdered that song on stage.",
  "I'm so embarrassed I could die",
  "I want to die of embarrassment",
  "I'm starving to death",
  "My boss is going to kill me",
  "I laughed so hard I couldn't breathe.",
  "I could kill myself laughing",
  "個 BB 食完奶好精神",
  "BB 食完奶瞓得好甜",
  "個囡囡跌低咗，不過冇事，繼續玩",
  "個 BB 有少少流鼻水，不過食嘢正常",
  "The baby is babbling happily in the crib",
  "我想殺死一隻蟑螂",
  "呢隻遊戲殺死我嘅時間",
  "我哋食咗藥，聽日再覆診",
  "新聞報道自殺率上升",
  "She killed it on the dance floor last night",
];

test("必須觸發 high", () => {
  const missed = MUST_HIGH.filter((s) => level(s) !== "high");
  assert.deepEqual(missed, [], `漏咗：\n${missed.join("\n")}`);
});

test("日常誇張講法唔可以 high", () => {
  const wrong = MUST_NOT_HIGH.filter((s) => level(s) === "high");
  assert.deepEqual(wrong, [], `誤報：\n${wrong.map((s) => s + " → " + detectRules(s).hits.map((h) => h.id).join(",")).join("\n")}`);
});

test("模稜兩可嘅應該係 review", () => {
  for (const s of ["做功課做到想死", "I laughed so hard I couldn't breathe.", "My boss is going to kill me", "kms lol", "我想消失", "新聞報道自殺率上升"]) {
    assert.equal(level(s), "review", s);
  }
});

test("完全冇事嘅句子係 none", () => {
  for (const s of ["今日天氣好好", "個 BB 食完奶好精神", "He killed it on stage tonight", "手機死機了"]) {
    assert.equal(level(s), "none", s);
  }
});

test("結果唔包含用戶原文", () => {
  const r = detectRules("I want to kill myself");
  assert.ok(!JSON.stringify(r).toLowerCase().includes("myself"));
});

test("正規化：簡繁、全形、零寬、leet", () => {
  assert.equal(normalizeText("我想自杀"), "我想自殺");
  assert.equal(normalizeText("ｋｉｌｌ"), "kill");
  assert.equal(normalizeText("ki\u200Bll"), "kill");
  assert.equal(normalizeText("k1ll mys3lf"), "kill myself");
});

test("極長／空輸入唔會出錯", () => {
  assert.equal(detectRules("").level, "none");
  assert.equal(detectRules("a".repeat(100000)).level, "none");
  assert.equal(detectRules("想死".repeat(5000)).level, "high");
});

test("decide：high 規則唔使問模型", () => {
  assert.equal(checkMessage("I want to kill myself", 0.0001).trigger, true);
  assert.equal(checkMessage("我真係好想死", 0.0).reason, "rule_high");
});

test("decide：模型單獨觸發", () => {
  const d = checkMessage("我覺得好灰", 0.9);
  assert.equal(d.trigger, true);
  assert.equal(d.reason, "model");
});

test("decide：review + 模型", () => {
  assert.equal(checkMessage("做功課做到想死", 0.0005).trigger, false);
  assert.equal(checkMessage("做功課做到想死", 0.0005).softPrompt, true);
  assert.equal(checkMessage("做功課做到想死", 0.05).trigger, true);
});

test("decide：模型唔可用時 review 都觸發（fail-safe）", () => {
  assert.equal(checkMessage("做功課做到想死", null).trigger, true);
  assert.equal(checkMessage("今日天氣好好", null).trigger, false);
});
