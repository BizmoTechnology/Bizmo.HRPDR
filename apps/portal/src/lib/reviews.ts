/** 360° değerlendirici ekranları için ortak tipler ve metinler */

export type ReviewRelation = "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";
export type ReviewAssignmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED";

export interface ReviewAssignmentSummary {
  id: string;
  relation: ReviewRelation;
  status: ReviewAssignmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  questionCount: number;
  answeredCount: number;
  subject: { firstName: string; lastName: string; position: string; department: string | null };
  cycle: { id: string; name: string; dueAt: string | null };
}

export interface ReviewNotice {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: string;
}

/** Değerlendiricinin gözünden ilişki: MANAGER = siz onun yöneticisisiniz */
export const RELATION_FOR_RATER: Record<ReviewRelation, string> = {
  SELF: "Öz değerlendirme",
  MANAGER: "Ekibinizden",
  PEER: "Çalışma arkadaşınız",
  SUBORDINATE: "Yöneticiniz",
};

export function privacyNote(relation: ReviewRelation, minRaters: number): string {
  if (relation === "MANAGER") return "Yönetici değerlendirmeleri raporda adınızla birlikte görünür.";
  if (relation === "SELF") return "Öz değerlendirmeniz, diğerlerinin değerlendirmesiyle karşılaştırılır.";
  return `Cevaplarınız anonimdir: yalnız en az ${minRaters} kişinin tamamladığı grubun ortalaması gösterilir; kimin ne verdiği görünmez.`;
}

export function formatDue(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}
