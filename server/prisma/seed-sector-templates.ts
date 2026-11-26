import { Prisma, type PrismaClient } from "@prisma/client";
import {
  SECTOR_TEMPLATES,
  templateQuestionFields,
  templateQuestionId,
  templateSetId,
} from "./sector-templates/index.js";

/**
 * Talaşlı imalat sektörel soru şablonlarını (CNC, depo, bakım, beyaz yaka) ekler.
 *
 * İdempotent ve yalnız ekleme yapar:
 * - Set zaten varsa (İK düzenlemiş ya da silmiş olsa bile) dokunulmaz.
 * - Sorular kalıcı kimlikle oluşturulur; var olan soru güncellenmez.
 * - Mevcut setler, değerlendirmeler ve oturumlar etkilenmez.
 */
export async function seedSectorTemplates(params: {
  prisma: PrismaClient;
  organizationId: string;
  createdById: string;
}): Promise<{ created: string[]; skipped: string[] }> {
  const { prisma, organizationId, createdById } = params;
  const created: string[] = [];
  const skipped: string[] = [];

  for (const template of SECTOR_TEMPLATES) {
    const setId = templateSetId(template, organizationId);
    const existing = await prisma.questionSet.findUnique({ where: { id: setId }, select: { id: true } });
    if (existing) {
      skipped.push(template.name);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const questionIds: string[] = [];
      for (const q of template.questions) {
        const id = templateQuestionId(template, q, organizationId);
        const { options, scoring, ...fields } = templateQuestionFields(template, q);
        await tx.question.upsert({
          where: { id },
          create: {
            id,
            ...fields,
            options: options ?? Prisma.DbNull,
            scoring: scoring ?? Prisma.DbNull,
            organizationId,
          },
          update: {},
        });
        questionIds.push(id);
      }

      await tx.questionSet.create({
        data: {
          id: setId,
          name: template.name,
          description: template.description,
          isActive: true,
          isDefault: false,
          ...template.weights,
          organizationId,
          createdById,
          items: {
            create: questionIds.map((questionId, i) => ({ questionId, order: i + 1, isRequired: true })),
          },
        },
      });
    });

    created.push(`${template.name} (${template.questions.length} soru)`);
  }

  return { created, skipped };
}
