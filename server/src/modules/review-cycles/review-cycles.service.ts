import type { FastifyBaseLogger } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { isMailerConfigured, sendMail } from "../../lib/mailer.js";
import type { ReviewRelationKey } from "../../services/review-results.service.js";

/** Değerlendirici önerisinde eş düzey sayısı üst sınırı */
const MAX_SUGGESTED_PEERS = 8;

export interface RaterEntry {
  personnelId: string;
  relation: ReviewRelationKey;
}

export interface SubjectSuggestion {
  personnelId: string;
  raters: RaterEntry[];
}

/** Org şemasında ve değerlendirici olarak kullanılabilen personel */
export const ACTIVE_PERSONNEL = { deletedAt: null, status: "ACTIVE" as const };

/**
 * Org şemasından (managerId) değerlendirici önerisi:
 * - SELF: kişinin kendisi (includeSelf ise)
 * - MANAGER: doğrudan yöneticisi
 * - SUBORDINATE: doğrudan astları
 * - PEER: aynı yöneticiye bağlı olanlar ve aynı ekipteki kişiler (yönetici ve astlar hariç)
 */
export async function suggestRaters(
  organizationId: string,
  subjectIds: string[],
  opts: { includeSelf: boolean },
): Promise<SubjectSuggestion[]> {
  const people = await prisma.personnel.findMany({
    where: { organizationId, ...ACTIVE_PERSONNEL },
    select: { id: true, managerId: true, teamId: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const byId = new Map(people.map((p) => [p.id, p]));

  const unknown = subjectIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new HttpError("Bazı personel bulunamadı veya aktif değil", 400, "INVALID_PERSONNEL");
  }

  return [...new Set(subjectIds)].map((sid) => {
    const s = byId.get(sid)!;
    const raters: RaterEntry[] = [];
    const taken = new Set<string>([s.id]);
    if (opts.includeSelf) raters.push({ personnelId: s.id, relation: "SELF" });

    if (s.managerId && byId.has(s.managerId)) {
      raters.push({ personnelId: s.managerId, relation: "MANAGER" });
      taken.add(s.managerId);
    }

    for (const p of people) {
      if (p.managerId === s.id && !taken.has(p.id)) {
        raters.push({ personnelId: p.id, relation: "SUBORDINATE" });
        taken.add(p.id);
      }
    }

    // Önce aynı yöneticiye bağlı olanlar, sonra aynı ekipten olanlar
    const siblings = s.managerId ? people.filter((p) => p.managerId === s.managerId) : [];
    const teammates = s.teamId ? people.filter((p) => p.teamId === s.teamId) : [];
    let peers = 0;
    for (const p of [...siblings, ...teammates]) {
      if (peers >= MAX_SUGGESTED_PEERS) break;
      if (taken.has(p.id)) continue;
      raters.push({ personnelId: p.id, relation: "PEER" });
      taken.add(p.id);
      peers += 1;
    }

    return { personnelId: s.id, raters };
  });
}

/**
 * Kaydedilecek atama planını doğrular: tüm kişiler aynı kurumda ve aktif,
 * SELF yalnız kişinin kendisi, kişi başına tek ilişki.
 */
export async function validateAssignmentPlan(
  organizationId: string,
  subjects: SubjectSuggestion[],
): Promise<void> {
  const subjectIds = subjects.map((s) => s.personnelId);
  if (new Set(subjectIds).size !== subjectIds.length) {
    throw new HttpError("Aynı kişi birden fazla kez değerlendirilen olarak eklenemez", 400, "DUPLICATE_SUBJECT");
  }

  const allIds = new Set<string>(subjectIds);
  for (const s of subjects) {
    const seen = new Set<string>();
    for (const r of s.raters) {
      if (seen.has(r.personnelId)) {
        throw new HttpError("Bir kişi aynı değerlendirilene yalnız bir grupta atanabilir", 400, "DUPLICATE_RATER");
      }
      seen.add(r.personnelId);
      if (r.relation === "SELF" && r.personnelId !== s.personnelId) {
        throw new HttpError("Öz değerlendirme yalnız kişinin kendisine atanabilir", 400, "INVALID_SELF");
      }
      if (r.relation !== "SELF" && r.personnelId === s.personnelId) {
        throw new HttpError("Kişi kendisini yönetici, eş düzey ya da ast olarak değerlendiremez", 400, "INVALID_RELATION");
      }
      allIds.add(r.personnelId);
    }
  }

  if (allIds.size === 0) return;
  const found = await prisma.personnel.count({
    where: { id: { in: [...allIds] }, organizationId, ...ACTIVE_PERSONNEL },
  });
  if (found !== allIds.size) {
    throw new HttpError("Bazı personel bulunamadı veya aktif değil", 400, "INVALID_PERSONNEL");
  }
}

export interface DeliveryReport {
  /** SMTP yapılandırılmış mı (false ise e-posta gönderilmedi; uydurma "gönderildi" yok) */
  mailConfigured: boolean;
  mailSent: number;
  mailFailed: number;
  /** Uygulama içi bildirim oluşturulan değerlendirici sayısı */
  notified: number;
  raters: number;
}

function portalUrl(): string {
  return (process.env["PORTAL_URL"] ?? "http://localhost:3002").replace(/\/$/, "");
}

/**
 * Değerlendiricilere davet / hatırlatma: değerlendirici başına tek uygulama içi
 * bildirim (Notification.personnelId) ve SMTP yapılandırılmışsa tek e-posta.
 */
export async function deliverToRaters(params: {
  kind: "INVITE" | "REMIND";
  cycle: { id: string; name: string; dueAt: Date | null };
  assignments: Array<{
    id: string;
    rater: { id: string; firstName: string; email: string };
    subject: { personnel: { firstName: string; lastName: string } };
    relation: string;
  }>;
  log: FastifyBaseLogger;
}): Promise<DeliveryReport> {
  const { kind, cycle, assignments, log } = params;
  const byRater = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = byRater.get(a.rater.id) ?? [];
    list.push(a);
    byRater.set(a.rater.id, list);
  }

  const report: DeliveryReport = {
    mailConfigured: isMailerConfigured(),
    mailSent: 0,
    mailFailed: 0,
    notified: 0,
    raters: byRater.size,
  };
  if (byRater.size === 0) return report;

  const due = cycle.dueAt
    ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(cycle.dueAt)
    : null;
  const title =
    kind === "INVITE" ? "Yeni 360° değerlendirme görevi" : "360° değerlendirme hatırlatması";

  await prisma.notification.createMany({
    data: [...byRater.entries()].map(([raterId, list]) => ({
      personnelId: raterId,
      type: kind === "INVITE" ? "REVIEW_INVITE" : "REVIEW_REMINDER",
      title,
      body:
        `"${cycle.name}" döneminde ${list.length} kişiyi değerlendirmeniz bekleniyor` +
        (due ? ` (son gün ${due}).` : "."),
      metadata: { cycleId: cycle.id, assignmentIds: list.map((a) => a.id) },
    })),
  });
  report.notified = byRater.size;

  if (!report.mailConfigured) return report;

  for (const list of byRater.values()) {
    const rater = list[0]!.rater;
    const names = list
      .map((a) =>
        a.relation === "SELF"
          ? "Kendiniz (öz değerlendirme)"
          : `${a.subject.personnel.firstName} ${a.subject.personnel.lastName}`,
      )
      .join("\n- ");
    const text =
      `Merhaba ${rater.firstName},\n\n` +
      `"${cycle.name}" 360° değerlendirme döneminde aşağıdaki kişileri değerlendirmeniz bekleniyor:\n- ${names}\n\n` +
      (due ? `Son gün: ${due}\n\n` : "") +
      `Personel portalından giriş yapın: ${portalUrl()}/reviews\n\n` +
      "Eş düzey ve ast değerlendirmeleri yalnız grup ortalaması olarak raporlanır.";
    try {
      const ok = await sendMail({ to: rater.email, subject: title, text });
      if (ok) report.mailSent += 1;
      else report.mailFailed += 1;
    } catch (err) {
      report.mailFailed += 1;
      log.warn({ err, cycleId: cycle.id }, "review mail failed");
    }
  }
  return report;
}

/** Yeni yöneticinin, kişinin kendi alt ağacında olmadığını doğrular (döngü engeli) */
export async function assertNoManagerCycle(
  organizationId: string,
  personnelId: string,
  managerId: string,
  db: Pick<typeof prisma, "personnel"> = prisma,
): Promise<void> {
  if (managerId === personnelId) {
    throw new HttpError("Kişi kendisinin yöneticisi olamaz", 400, "INVALID_MANAGER");
  }
  const people = await db.personnel.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  const parent = new Map(people.map((p) => [p.id, p.managerId]));
  if (!parent.has(managerId)) {
    throw new HttpError("Yönetici bulunamadı", 400, "INVALID_MANAGER");
  }
  let cur: string | null | undefined = managerId;
  const guard = new Set<string>();
  while (cur) {
    if (cur === personnelId) {
      throw new HttpError(
        "Bu değişiklik döngü oluşturur: seçilen yönetici bu kişinin altında",
        409,
        "MANAGER_CYCLE",
      );
    }
    if (guard.has(cur)) break;
    guard.add(cur);
    cur = parent.get(cur);
  }
}
