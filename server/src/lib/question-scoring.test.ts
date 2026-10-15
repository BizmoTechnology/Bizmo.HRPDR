import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  keyedChoiceScore,
  parseQuestionScoring,
  questionScoringInputSchema,
  questionScoringIssue,
} from "./question-scoring.js";

describe("parseQuestionScoring", () => {
  it("boş, geçersiz veya etkisiz kuralı null döndürür", () => {
    assert.equal(parseQuestionScoring(null), null);
    assert.equal(parseQuestionScoring(undefined), null);
    assert.equal(parseQuestionScoring("ters"), null);
    assert.equal(parseQuestionScoring({ reverse: false }), null);
    assert.equal(parseQuestionScoring({ key: { A: 1 } }), null);
    assert.equal(parseQuestionScoring({ key: { A: 1, B: 1 } }), null);
    assert.equal(parseQuestionScoring({ key: { A: -1, B: 2 } }), null);
  });

  it("geçerli kuralı sadeleştirerek okur", () => {
    assert.deepEqual(parseQuestionScoring({ reverse: true }), { reverse: true });
    assert.deepEqual(parseQuestionScoring({ key: { A: 0, B: 3 }, extra: 1 }), { key: { A: 0, B: 3 } });
  });
});

describe("questionScoringInputSchema", () => {
  it("bilinmeyen alanı reddeder", () => {
    assert.equal(questionScoringInputSchema.safeParse({ reverse: true, ters: true }).success, false);
    assert.equal(questionScoringInputSchema.safeParse({ key: { A: 1, B: 0 } }).success, true);
  });
});

describe("questionScoringIssue", () => {
  const options = { A: "Bir", B: "İki", C: "Üç" };

  it("uyumlu kuralları kabul eder", () => {
    assert.equal(questionScoringIssue("SCALE", { reverse: true }, null), null);
    assert.equal(questionScoringIssue("MULTIPLE_CHOICE", { key: { A: 2, B: 0, C: 1 } }, options), null);
    assert.equal(questionScoringIssue("OPEN_ENDED", null, null), null);
  });

  it("tipe uymayan kuralı reddeder", () => {
    assert.match(questionScoringIssue("MULTIPLE_CHOICE", { reverse: true }, options)!, /skala/);
    assert.match(questionScoringIssue("SCALE", { key: { A: 1, B: 0 } }, null)!, /çoktan seçmeli/);
  });

  it("seçeneklerle örtüşmeyen anahtarı reddeder", () => {
    assert.match(questionScoringIssue("MULTIPLE_CHOICE", { key: { A: 1, B: 0 } }, options)!, /eksik seçenek: C/);
    assert.match(
      questionScoringIssue("MULTIPLE_CHOICE", { key: { A: 1, B: 0, C: 0, D: 2 } }, options)!,
      /tanımsız seçenek: D/,
    );
    assert.match(questionScoringIssue("MULTIPLE_CHOICE", { key: { A: 1, B: 0 } }, null)!, /seçenekler/);
    assert.match(questionScoringIssue("MULTIPLE_CHOICE", { key: { A: 1, B: 1, C: 1 } }, options)!, /iki farklı/);
  });
});

describe("keyedChoiceScore", () => {
  it("en iyi seçeneğe 10, en kötüye 0 verir", () => {
    const scoring = { key: { A: 1, B: 3, C: 0, D: 2 } };
    assert.equal(keyedChoiceScore(scoring, "B"), 10);
    assert.equal(keyedChoiceScore(scoring, "C"), 0);
    assert.equal(keyedChoiceScore(scoring, "X"), null);
    assert.equal(keyedChoiceScore(null, "A"), null);
    assert.equal(keyedChoiceScore(scoring, null), null);
  });
});
