import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPortalQuestion, type SnapshotQuestion } from "./session-questions.service.js";

describe("toPortalQuestion", () => {
  it("puan anahtarını ve iç alanları personele göndermez", () => {
    const q: SnapshotQuestion = {
      id: "q1",
      text: "Ne yaparsınız?",
      subText: null,
      dimension: "DOMAIN_ALIGNMENT",
      type: "MULTIPLE_CHOICE",
      phase: "CORE",
      weight: 1,
      customWeight: null,
      options: { A: "Durdururum", B: "Devam ederim" },
      scoring: { key: { A: 3, B: 0 } },
      minScale: null,
      maxScale: null,
      order: 1,
      isRequired: true,
    };
    const portal = toPortalQuestion(q);
    assert.equal("scoring" in portal, false);
    assert.equal("dimension" in portal, false);
    assert.equal("weight" in portal, false);
    assert.deepEqual(portal.options, q.options);
  });
});
