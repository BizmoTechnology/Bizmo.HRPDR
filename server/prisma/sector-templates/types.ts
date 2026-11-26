import type { QuestionDimension, QuestionPhase, QuestionType } from "@prisma/client";

/**
 * Sektörel soru şablonu. Kaynak çerçeveler ve lisans notları:
 * docs/sektorel-soru-sablonlari.md
 */
export interface TemplateQuestion {
  /** Şablon içinde kalıcı anahtar; soru kimliği bundan türetilir (değiştirmeyin). */
  key: string;
  text: string;
  subText?: string;
  dimension: QuestionDimension;
  type: QuestionType;
  phase: QuestionPhase;
  /** Çoktan seçmeli seçenekler: { A: "...", B: "..." } */
  options?: Record<string, string>;
  /** Ters madde (SCALE) veya puan anahtarı (MULTIPLE_CHOICE); bkz. src/lib/question-scoring.ts */
  scoring?: { reverse: true } | { key: Record<string, number> };
  /** Takip sorusu için yönlendirme (STAR derinleştirme) */
  followUpPrompt?: string;
  /** Ölçülen yapı ve kaynak: big5:*, onet:*, great8:*, guvenlik:*, konu:*, ref:* */
  tags: string[];
}

export interface SectorTemplate {
  /** Kalıcı şablon kısa adı; set ve soru kimlikleri bundan türetilir. */
  slug: string;
  name: string;
  description: string;
  /** Boyut ağırlıkları; toplamı 100 olmalı */
  weights: {
    weightLogical: number;
    weightLeadership: number;
    weightSocial: number;
    weightGrowth: number;
    weightDomain: number;
  };
  /** Her soruya eklenecek ortak etiketler (rol, sektör, O*NET kodu) */
  commonTags: string[];
  questions: TemplateQuestion[];
}

/** 5'li Likert (IPIP yanıt biçiminin sade Türkçesi) */
export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;
export const LIKERT_SELF = "1 = Bana hiç uymuyor · 5 = Bana tamamen uyuyor";

export const STAR_HINT =
  "Gerçek bir örnek seçin: Durum neydi, sizin göreviniz neydi, siz ne yaptınız, sonuç ne oldu?";
export const STAR_FOLLOW_UP =
  "Cevap genel kaldıysa somut tek bir olaya indir: kişinin kendi yaptığı adımları ('biz' değil 'ben') ve ölçülebilir sonucu sor.";
export const SJT_HINT = "Size en uygun gelen davranışı seçin.";
