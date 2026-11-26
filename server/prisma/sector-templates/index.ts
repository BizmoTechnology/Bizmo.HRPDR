import { BAKIM_TEMPLATE } from "./bakim.js";
import { BEYAZ_YAKA_TEMPLATE } from "./beyaz-yaka.js";
import { CNC_TEMPLATE } from "./cnc.js";
import { DEPO_TEMPLATE } from "./depo.js";
import {
  LIKERT_MAX,
  LIKERT_MIN,
  LIKERT_SELF,
  STAR_FOLLOW_UP,
  STAR_HINT,
  type SectorTemplate,
  type TemplateQuestion,
} from "./types.js";

export type { SectorTemplate, TemplateQuestion } from "./types.js";

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  CNC_TEMPLATE,
  DEPO_TEMPLATE,
  BAKIM_TEMPLATE,
  BEYAZ_YAKA_TEMPLATE,
];

/**
 * Kalıcı kimlikler: seed tekrar çalıştığında aynı kayıtlar bulunur. Organizasyon
 * kimliği eklenir; böylece her organizasyon kendi kopyasını alır.
 */
export function templateSetId(template: SectorTemplate, organizationId: string): string {
  return `sektor-${template.slug}--${organizationId}`;
}

export function templateQuestionId(
  template: SectorTemplate,
  question: TemplateQuestion,
  organizationId: string,
): string {
  return `sektor-${template.slug}-${question.key}--${organizationId}`;
}

/** Şablon sorusunu veritabanı alanlarına çevirir; tipe göre varsayılanları uygular. */
export function templateQuestionFields(template: SectorTemplate, q: TemplateQuestion) {
  const isScale = q.type === "SCALE";
  const isBehavioral = q.type === "BEHAVIORAL";
  return {
    text: q.text,
    subText: q.subText ?? (isScale ? LIKERT_SELF : isBehavioral ? STAR_HINT : null),
    dimension: q.dimension,
    type: q.type,
    phase: q.phase,
    weight: 1,
    followUpPrompt: q.followUpPrompt ?? (isBehavioral ? STAR_FOLLOW_UP : null),
    options: q.options ?? null,
    scoring: q.scoring ?? null,
    minScale: isScale ? LIKERT_MIN : null,
    maxScale: isScale ? LIKERT_MAX : null,
    tags: [...new Set([...template.commonTags, ...q.tags])],
    language: "tr",
    isAiGenerated: false,
  };
}
