// 執行：npm test -w @angelifeline/core（Node 22.15 或以上）
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPII, MASK_LIMITS } from "./angelifeline-mask";

test("電話：8 位或以上要遮，短號碼（999／112）唔好遮", () => {
  const phone = maskPII("my number is 91234567, I feel odd tonight");
  assert.ok(phone.text.includes("[phone]"));
  assert.ok(!phone.text.includes("91234567"));
  assert.equal(phone.counts.phone, 1);

  const short = maskPII("call 999 or 112 now");
  assert.ok(short.text.includes("999"));
  assert.ok(short.text.includes("112"));
});

test("身份證：認得常見寫法，但唔會食咗電話", () => {
  for (const id of ["A123456(7)", "AB123456(7)", "A 123456 (7)", "AB123456"]) {
    assert.ok(maskPII(`my hkid is ${id}`).text.includes("[id]"), id);
  }
  // 「is 912345」唔可以當身份證，否則電話規則冇機會跑
  assert.ok(!maskPII("my number is 91234567").text.includes("[id]"));
  // 內地身份證（18 位）
  assert.ok(maskPII("身份證 110101199003078515").text.includes("[id]"));
});

test("電郵、信用卡（Luhn）", () => {
  assert.ok(maskPII("mail me at a.b+c@example.co.uk").text.includes("[email]"));
  assert.ok(maskPII("card 4242 4242 4242 4242").text.includes("[card]"));
  // Luhn 唔過 → 當電話，唔會當卡
  const notCard = maskPII("4242 4242 4242 4241");
  assert.ok(!notCard.text.includes("[card]"));
});

test("先遮蔽後截斷，保留最近嘅內容", () => {
  const long = `${"a".repeat(MASK_LIMITS.maxChars)} my number is 91234567`;
  const out = maskPII(long);
  assert.equal(out.truncated, true);
  assert.ok(out.text.includes("[phone]"));
  assert.ok(!out.text.includes("91234567"));
});
