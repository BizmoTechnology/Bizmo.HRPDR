import type {
  QuestionDimension,
  PersonnelShift,
  PersonnelStatus,
  TerminationReason,
  UserRole,
} from "../types";

// ─────────────────────────────────────────
// DIMENSION METADATA
// ─────────────────────────────────────────

export const DIMENSION_LABELS: Record<string, string> = {
  LOGICAL_ALGORITHMIC: "Mantıksal / Algoritmik",
  LEADERSHIP: "Liderlik",
  SOCIAL_INTELLIGENCE: "Sosyal Zeka",
  GROWTH_POTENTIAL: "Büyüme Potansiyeli",
  DOMAIN_ALIGNMENT: "Alan Uyumu",
};

export const DIMENSION_SHORT_LABELS: Record<string, string> = {
  LOGICAL_ALGORITHMIC: "Mantıksal",
  LEADERSHIP: "Liderlik",
  SOCIAL_INTELLIGENCE: "Sosyal",
  GROWTH_POTENTIAL: "Büyüme",
  DOMAIN_ALIGNMENT: "Alan",
};

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  LOGICAL_ALGORITHMIC:
    "Sistematik düşünme, örüntü tanıma, adım adım akıl yürütme, hata kök nedeni analizi",
  LEADERSHIP:
    "Sorumluluk alma, ekip etkisi, inisiyatif, çatışma yönetimi, yönlendirme",
  SOCIAL_INTELLIGENCE:
    "Empati, iletişim kalitesi, güven inşası, ikna ve iş birliği",
  GROWTH_POTENTIAL:
    "Öğrenme iştahı, değişime uyum, geri bildirimden yararlanma, gelişime açıklık",
  DOMAIN_ALIGNMENT:
    "Talaşlı imalat / fabrika bağlamında rol, ortam ve sorumluluk uyumu; kariyer yönelimi",
};

export const ALL_DIMENSIONS: QuestionDimension[] = [
  "LOGICAL_ALGORITHMIC",
  "LEADERSHIP",
  "SOCIAL_INTELLIGENCE",
  "GROWTH_POTENTIAL",
  "DOMAIN_ALIGNMENT",
];

// ─────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────

/** Tüm skorlar 0.0–10.0 arası, tek ondalık hassasiyetle saklanır */
export const SCORE_MIN = 0.0;
export const SCORE_MAX = 10.0;
export const SCORE_PRECISION = 1;

export const scoreLabel = (score: number): "high" | "medium" | "low" => {
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
};

// ─────────────────────────────────────────
// ROLE LABELS
// ─────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Süper Admin",
  ADMIN: "Admin",
  HR_MANAGER: "İK Yöneticisi",
  ANALYST: "Analist",
  VIEWER: "İzleyici",
};

// ─────────────────────────────────────────
// SHIFT LABELS
// ─────────────────────────────────────────

export const SHIFT_LABELS: Record<PersonnelShift, string> = {
  NONE: "Belirtilmemiş",
  MORNING: "Sabah",
  AFTERNOON: "Öğleden Sonra",
  NIGHT: "Gece",
  ROTATING: "Döner",
};

// ─────────────────────────────────────────
// PERSONEL DURUMU VE AYRILIŞ
// ─────────────────────────────────────────

export const PERSONNEL_STATUS_LABELS: Record<PersonnelStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Pasif",
  ON_LEAVE: "İzinli",
  TERMINATED: "Ayrıldı",
};

export const TERMINATION_REASONS: TerminationReason[] = [
  "RESIGNATION",
  "DISMISSAL",
  "MUTUAL_AGREEMENT",
  "CONTRACT_END",
  "RETIREMENT",
  "OTHER",
];

export const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
  RESIGNATION: "İstifa",
  DISMISSAL: "İşveren feshi",
  MUTUAL_AGREEMENT: "Karşılıklı anlaşma",
  CONTRACT_END: "Sözleşme sonu",
  RETIREMENT: "Emeklilik",
  OTHER: "Diğer",
};

// ─────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────
// CONSENT TYPES
// ─────────────────────────────────────────

export const CONSENT_TYPES = {
  DATA_PROCESSING: "DATA_PROCESSING",
  AI_ASSESSMENT: "AI_ASSESSMENT",
  PORTAL_TERMS: "PORTAL_TERMS",
} as const;

export const CURRENT_LEGAL_TEXT_VERSION = "v1.0.0-2026";

// ─────────────────────────────────────────
// QUESTION TYPES/PHASES
// ─────────────────────────────────────────

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  OPEN_ENDED: "Açık Uçlu",
  SITUATIONAL: "Durumsal",
  BEHAVIORAL: "Davranışsal",
  SCALE: "Skala",
  MULTIPLE_CHOICE: "Çoktan Seçmeli",
};

export const QUESTION_PHASE_LABELS: Record<string, string> = {
  ICEBREAKER: "Buz Kırma",
  CORE: "Ana Değerlendirme",
  CLOSING: "Kapanış",
};
export * from "./sso";
