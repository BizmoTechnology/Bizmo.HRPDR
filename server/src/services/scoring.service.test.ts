import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeScaleScores, scoreAnswer, type ScorableQuestion } from "./scoring.service.js";

const likert = (id: string, scoring?: unknown): ScorableQuestion => ({
  id,
  dimension: "DOMAIN_ALIGNMENT",
  type: "SCALE",
  minScale: 1,
  maxScale: 5,
  scoring,
});

const sjt = (id: string, key: Record<string, number> | null): ScorableQuestion => ({
  id,
  dimension: "SOCIAL_INTELLIGENCE",
  type: "MULTIPLE_CHOICE",
  scoring: key ? { key } : null,
});

describe("scoreAnswer — SCALE", () => {
  it("düz maddeyi doğrusal puanlar (eski davranış)", () => {
    const q = likert("q");
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 1 }), 0);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 3 }), 5);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 5 }), 10);
  });

  it("ters maddede ölçeği çevirir", () => {
    const q = likert("q", { reverse: true });
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 1 }), 10);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 2 }), 7.5);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 5 }), 0);
  });

  it("minScale/maxScale yoksa 1–10 varsayar", () => {
    const q: ScorableQuestion = { id: "q", dimension: "LEADERSHIP", type: "SCALE", scoring: { reverse: true } };
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 10 }), 0);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 1 }), 10);
  });

  it("cevapsız veya geçersiz aralıkta null döner", () => {
    assert.equal(scoreAnswer(likert("q"), undefined), null);
    assert.equal(scoreAnswer(likert("q"), { questionId: "q", scaleValue: null }), null);
    const broken: ScorableQuestion = { ...likert("q"), minScale: 5, maxScale: 5 };
    assert.equal(scoreAnswer(broken, { questionId: "q", scaleValue: 5 }), null);
  });

  it("bozuk kuralı yok sayar, düz puanlar", () => {
    const q = likert("q", { reverse: "evet" });
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 5 }), 10);
  });
});

describe("scoreAnswer — MULTIPLE_CHOICE", () => {
  it("SJT anahtarını 0–10 aralığına çevirir", () => {
    const q = sjt("q", { A: 1, B: 3, C: 0, D: 2 });
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: null, choiceKey: "B" }), 10);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: null, choiceKey: "C" }), 0);
    assert.ok(Math.abs(scoreAnswer(q, { questionId: "q", scaleValue: null, choiceKey: "D" })! - 20 / 3) < 1e-9);
  });

  it("tek doğrulu bilgi sorusunu 0/10 puanlar", () => {
    const q = sjt("q", { A: 0, B: 1, C: 0 });
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: null, choiceKey: "B" }), 10);
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: null, choiceKey: "A" }), 0);
  });

  it("anahtarsız soru, anahtarda olmayan seçim veya tek puanlı anahtar puanlanmaz", () => {
    assert.equal(scoreAnswer(sjt("q", null), { questionId: "q", scaleValue: null, choiceKey: "A" }), null);
    assert.equal(
      scoreAnswer(sjt("q", { A: 1, B: 0 }), { questionId: "q", scaleValue: null, choiceKey: "Z" }),
      null,
    );
    assert.equal(
      scoreAnswer(sjt("q", { A: 2, B: 2 }), { questionId: "q", scaleValue: null, choiceKey: "A" }),
      null,
    );
  });

  it("açık uçlu soruları puanlamaz", () => {
    const q: ScorableQuestion = { id: "q", dimension: "LEADERSHIP", type: "OPEN_ENDED", scoring: { reverse: true } };
    assert.equal(scoreAnswer(q, { questionId: "q", scaleValue: 3 }), null);
  });
});

describe("computeScaleScores", () => {
  it("kuralsız sorularda eski sonucu korur", () => {
    const questions: ScorableQuestion[] = [
      { id: "a", dimension: "LEADERSHIP", type: "SCALE", minScale: 1, maxScale: 10 },
      { id: "b", dimension: "LEADERSHIP", type: "OPEN_ENDED" },
      { id: "c", dimension: "SOCIAL_INTELLIGENCE", type: "MULTIPLE_CHOICE" },
    ];
    const scores = computeScaleScores(questions, [
      { questionId: "a", scaleValue: 8 },
      { questionId: "b", scaleValue: null },
      { questionId: "c", scaleValue: null, choiceKey: "A" },
    ]);
    assert.deepEqual(scores, { LEADERSHIP: 7.8 });
  });

  it("düz + ters maddeleri aynı boyutta birleştirir (tutarlı cevaplayan yüksek alır)", () => {
    const questions = [likert("duz"), likert("ters", { reverse: true })];
    const consistent = computeScaleScores(questions, [
      { questionId: "duz", scaleValue: 5 },
      { questionId: "ters", scaleValue: 1 },
    ]);
    assert.deepEqual(consistent, { DOMAIN_ALIGNMENT: 10 });

    // Her maddeye "katılıyorum" diyen (onaylama eğilimi) orta puanda kalır
    const acquiescent = computeScaleScores(questions, [
      { questionId: "duz", scaleValue: 5 },
      { questionId: "ters", scaleValue: 5 },
    ]);
    assert.deepEqual(acquiescent, { DOMAIN_ALIGNMENT: 5 });
  });

  it("anahtarlı seçimleri soru ağırlığıyla katar", () => {
    const questions: ScorableQuestion[] = [
      { ...sjt("s1", { A: 3, B: 0 }), weight: 2 },
      sjt("s2", { A: 3, B: 0 }),
    ];
    const scores = computeScaleScores(questions, [
      { questionId: "s1", scaleValue: null, choiceKey: "A" },
      { questionId: "s2", scaleValue: null, choiceKey: "B" },
    ]);
    // (10·2 + 0·1) / 3
    assert.deepEqual(scores, { SOCIAL_INTELLIGENCE: 6.7 });
  });

  it("puanlama kuralı olmayan eski snapshot sorularıyla çalışır", () => {
    const legacy = [{ id: "x", dimension: "GROWTH_POTENTIAL", type: "SCALE", minScale: 1, maxScale: 10 }];
    assert.deepEqual(computeScaleScores(legacy, [{ questionId: "x", scaleValue: 1 }]), { GROWTH_POTENTIAL: 0 });
  });
});
