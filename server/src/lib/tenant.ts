import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

/**
 * İstemciden gelen ilişki kimliklerinin aynı organizasyona ait olduğunu
 * doğrular. Aksi halde başka kiracının kayıtlarına bağlanmak mümkün olur.
 */

export async function assertDepartmentAndTeam(
  organizationId: string,
  departmentId: string | null | undefined,
  teamId: string | null | undefined,
): Promise<void> {
  if (departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!dept) throw new HttpError("Departman bulunamadı", 400, "INVALID_DEPARTMENT");
  }

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId, deletedAt: null },
      select: { departmentId: true },
    });
    if (!team) throw new HttpError("Ekip bulunamadı", 400, "INVALID_TEAM");
    if (departmentId && team.departmentId !== departmentId) {
      throw new HttpError("Ekip seçilen departmana ait değil", 400, "TEAM_DEPARTMENT_MISMATCH");
    }
  }
}

/**
 * @param alreadyInSet Sette zaten bulunan soru kimlikleri: sonradan silinmiş olsalar
 *   bile set düzenlenebilsin diye kabul edilir (yeni eklenen sorular silinmemiş olmalı).
 */
export async function assertQuestionsInOrg(
  organizationId: string,
  questionIds: string[],
  alreadyInSet: ReadonlySet<string> = new Set(),
): Promise<void> {
  const unique = [...new Set(questionIds)];
  if (unique.length !== questionIds.length) {
    throw new HttpError("Aynı soru sete birden fazla kez eklenemez", 400, "DUPLICATE_QUESTION");
  }
  if (unique.length === 0) return;

  const found = await prisma.question.findMany({
    where: { id: { in: unique }, organizationId },
    select: { id: true, deletedAt: true },
  });
  const valid = found.filter((q) => !q.deletedAt || alreadyInSet.has(q.id));
  if (valid.length !== unique.length) {
    throw new HttpError("Bazı sorular bulunamadı veya silinmiş", 400, "INVALID_QUESTION");
  }
}

export async function assertQuestionSetInOrg(
  organizationId: string,
  questionSetId: string,
): Promise<{ id: string; itemCount: number }> {
  const set = await prisma.questionSet.findFirst({
    where: { id: questionSetId, organizationId, deletedAt: null },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!set) throw new HttpError("Soru seti bulunamadı", 400, "INVALID_QUESTION_SET");
  return { id: set.id, itemCount: set._count.items };
}
