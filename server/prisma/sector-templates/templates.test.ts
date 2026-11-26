import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { questionScoringIssue } from "../../src/lib/question-scoring.js";
import { computeScaleScores, DIMENSIONS, type ScorableAnswer } from "../../src/services/scoring.service.js";
import { SECTOR_TEMPLATES, templateQuestionFields, templateQuestionId } from "./index.js";

const TYPES = ["SCALE", "SITUATIONAL", "BEHAVIORAL", "MULTIPLE_CHOICE", "OPEN_ENDED"];
const PHASES = ["ICEBREAKER", "CORE", "CLOSING"];

describe("sektörel soru şablonları", () => {
  it("dört rol, tekil kısa adlarla", () => {
    assert.deepEqual(
      SECTOR_TEMPLATES.map((t) => t.slug),
      ["cnc", "depo", "bakim", "beyaz-yaka"],
    );
  });

  for (const template of SECTOR_TEMPLATES) {
    describe(template.name, () => {
      const fields = template.questions.map((q) => ({ q, f: templateQuestionFields(template, q) }));

      it("boyut ağırlıklarının toplamı 100", () => {
        const w = template.weights;
        assert.equal(w.weightLogical + w.weightLeadership + w.weightSocial + w.weightGrowth + w.weightDomain, 100);
      });

      it("30–40 soru, tekil anahtar ve kimlik", () => {
        const n = template.questions.length;
        assert.ok(n >= 30 && n <= 40, `soru sayısı ${n}`);
        const keys = template.questions.map((q) => q.key);
        assert.equal(new Set(keys).size, n);
        const ids = template.questions.map((q) => templateQuestionId(template, q, "org"));
        assert.equal(new Set(ids).size, n);
      });

      it("her boyut, soru tipi ve aşama temsil ediliyor; aşamalar sıralı", () => {
        for (const d of DIMENSIONS) assert.ok(template.questions.some((q) => q.dimension === d), d);
        for (const t of TYPES) assert.ok(template.questions.some((q) => q.type === t), t);
        const phaseOrder = template.questions.map((q) => PHASES.indexOf(q.phase));
        for (const p of phaseOrder) assert.ok(p >= 0);
        assert.deepEqual(phaseOrder, [...phaseOrder].sort((a, b) => a - b));
        for (const p of PHASES) assert.ok(template.questions.some((q) => q.phase === p), p);
      });

      it("alan uzunlukları API sınırlarına uyuyor", () => {
        for (const { q, f } of fields) {
          assert.ok(f.text.length <= 2000, q.key);
          assert.ok((f.subText ?? "").length <= 1000, q.key);
          for (const tag of f.tags) assert.ok(tag.length <= 50, `${q.key}: ${tag}`);
          for (const k of Object.keys(f.options ?? {})) assert.ok(k.length <= 50, q.key);
        }
      });

      it("puanlama kuralları soru tipiyle uyumlu", () => {
        for (const { q, f } of fields) {
          assert.equal(questionScoringIssue(q.type, f.scoring, f.options), null, q.key);
          if (q.type === "SCALE") {
            assert.equal(f.minScale, 1, q.key);
            assert.equal(f.maxScale, 5, q.key);
            assert.ok(f.subText, q.key);
          }
          if (q.type === "MULTIPLE_CHOICE") {
            assert.ok(Object.keys(q.options ?? {}).length >= 3, q.key);
            const keyed = !!q.scoring && "key" in q.scoring;
            assert.equal(keyed, !q.tags.includes("puansiz"), `${q.key}: puansız etiketi ile anahtar uyumsuz`);
            if (keyed) {
              const values = Object.values((q.scoring as { key: Record<string, number> }).key);
              const best = Math.max(...values);
              assert.equal(values.filter((v) => v === best).length, 1, `${q.key}: tek en iyi seçenek olmalı`);
              assert.ok(q.tags.includes("sjt") || q.tags.includes("bilgi"), q.key);
            }
          }
          if (q.tags.includes("ters-madde")) assert.deepEqual(q.scoring, { reverse: true }, q.key);
        }
      });

      it("ters maddeler var ve her boyut en az üç deterministik soruyla ölçülüyor", () => {
        const reversed = template.questions.filter((q) => q.scoring && "reverse" in q.scoring);
        assert.ok(reversed.length >= 4, `ters madde ${reversed.length}`);
        for (const d of DIMENSIONS) {
          const scored = template.questions.filter(
            (q) => q.dimension === d && (q.type === "SCALE" || (q.scoring && "key" in q.scoring)),
          );
          assert.ok(scored.length >= 3, `${d}: ${scored.length}`);
        }
      });

      it("ölçülen yapının kaynağı etikette (ref:)", () => {
        for (const q of template.questions) {
          const needsRef = q.type !== "OPEN_ENDED" || q.phase === "CORE";
          if (needsRef) assert.ok(q.tags.some((t) => t.startsWith("ref:")), q.key);
        }
      });

      it("en iyi cevaplar 10, en kötü cevaplar 0 puan verir (ters maddeler dahil)", () => {
        const questions = fields.map(({ q, f }) => ({ id: q.key, ...f }));
        const answer = (pick: "best" | "worst"): ScorableAnswer[] =>
          questions.map((q) => {
            if (q.type === "SCALE") {
              const high = pick === "best" ? !q.scoring : !!q.scoring;
              return { questionId: q.id, scaleValue: high ? 5 : 1 };
            }
            const key = (q.scoring as { key?: Record<string, number> } | null)?.key;
            if (!key) return { questionId: q.id, scaleValue: null, choiceKey: "A" };
            const sorted = Object.entries(key).sort((a, b) => a[1] - b[1]);
            const choice = pick === "best" ? sorted[sorted.length - 1]![0] : sorted[0]![0];
            return { questionId: q.id, scaleValue: null, choiceKey: choice };
          });

        const best = computeScaleScores(questions, answer("best"));
        const worst = computeScaleScores(questions, answer("worst"));
        for (const d of DIMENSIONS) {
          assert.equal(best[d], 10, `${d} en iyi`);
          assert.equal(worst[d], 0, `${d} en kötü`);
        }
      });
    });
  }
});
