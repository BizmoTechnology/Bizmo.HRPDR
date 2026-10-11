import { Prisma, type AiProvider } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decrypt } from "../lib/crypto.js";
import { requireActiveAiConfig } from "../lib/ai-connection.js";
import { completeChatMulti, type LlmMessage } from "../lib/llm.js";

const MAX_PERSONNEL_IN_CONTEXT = 72;
const MAX_JSON_CHARS = 2800;
/** Departman adından türetilen kelime eşlemesi için min. uzunluk (3 → çok fazla yanlış pozitif) */
const MIN_DEPT_TOKEN_LEN = 4;

/** Türkçe soruda sık geçen kısa kelimeler — departman token eşlemesini atla */
const DEPT_TOKEN_BLOCKLIST = new Set([
  "için",
  "veya",
  "ile",
  "bir",
  "bu",
  "şu",
  "değil",
  "gibi",
  "kadar",
  "daha",
  "çok",
  "olan",
  "olarak",
  "sonra",
  "önce",
  "arası",
  "vardır",
  "hangi",
  "kim",
  "nasıl",
  "neden",
  "mi",
  "mı",
  "mu",
  "mü",
]);

export const HR_ASSISTANT_SYSTEM = `Sen PotansiyelHaritası platformunda deneyimli bir İK danışmanısın.
Elindeki personel verilerini (değerlendirme boyut skorları, HR PDR analizi, terfi hazırlığı, SWOT, kariyer önerileri, psikolojik özetler) kullanarak yöneticilere stratejik personel kararlarında yardımcı olursun.

## Kurum verisi özeti
{context}

## Kurallar
- Yanıtları Türkçe ver.
- Her öneriyi mümkünse somut verilerle destekle (skor, boyut adı, terfi hazırlığı READY/DEVELOPING/NOT_READY).
- Birden fazla aday varsa karşılaştırmalı madde işaretli liste veya tablo benzeri düzen kullan.
- Veride olmayan kişileri uydurma; emin değilsen bunu belirt.
- Soruda adı veya sicili geçen personel bağlamda öncelikle listelenmiş olabilir; önce bu kayıtlara bak.
- Riskleri ve gelişim gereksinimlerini de yaz.
- Markdown kullanabilirsin (başlıklar, kalın, listeler).`;

function truncateForContext(val: unknown, max = MAX_JSON_CHARS): string {
  if (val === null || val === undefined) return "(yok)";
  const s = typeof val === "string" ? val : JSON.stringify(val, null, 0);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [kesildi]`;
}

/** Soru metninde geçen departman adlarına göre filtre kimlikleri */
async function resolveDepartmentIdsFromQuestion(
  organizationId: string,
  question: string,
): Promise<{ ids: string[]; matchedNames: string[] }> {
  const deps = await prisma.department.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true },
  });

  const qNorm = question.trim().toLocaleLowerCase("tr-TR");
  const matched: typeof deps = [];

  for (const d of deps) {
    const nameLower = d.name.trim().toLocaleLowerCase("tr-TR");
    if (!nameLower) continue;
    if (qNorm.includes(nameLower)) {
      matched.push(d);
      continue;
    }
    const tokens = nameLower
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= MIN_DEPT_TOKEN_LEN && !DEPT_TOKEN_BLOCKLIST.has(w),
      );
    for (const t of tokens) {
      if (qNorm.includes(t)) {
        matched.push(d);
        break;
      }
    }
  }

  const uniq = [...new Map(matched.map((d) => [d.id, d])).values()];
  return {
    ids: uniq.map((d) => d.id),
    matchedNames: uniq.map((d) => d.name),
  };
}

/** Soruda geçen ad-soyad veya sicile göre personel kimlikleri (yanlış departman filtresinden muaf tutmak için) */
async function resolvePersonnelIdsMentionedInQuestion(
  organizationId: string,
  question: string,
): Promise<string[]> {
  const qNorm = question
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();

  const rows = await prisma.personnel.findMany({
    where: { organizationId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
    },
  });

  const ids = new Set<string>();

  for (const p of rows) {
    const fn = p.firstName.trim().toLocaleLowerCase("tr-TR");
    const ln = p.lastName.trim().toLocaleLowerCase("tr-TR");
    const full = `${fn} ${ln}`.trim();
    const fullComma = `${ln}, ${fn}`;

    if (full.length >= 5 && qNorm.includes(full)) {
      ids.add(p.id);
      continue;
    }
    if (fullComma.length >= 5 && qNorm.includes(fullComma)) {
      ids.add(p.id);
      continue;
    }

    const eid = p.employeeId.trim().toLocaleLowerCase("tr-TR");
    if (eid.length >= 2 && qNorm.includes(eid)) {
      ids.add(p.id);
      continue;
    }

    if (fn.length >= 4 && qNorm.includes(fn)) {
      ids.add(p.id);
    }
    if (ln.length >= 4 && qNorm.includes(ln)) {
      ids.add(p.id);
    }
  }

  return [...ids];
}

const PERSONNEL_CONTEXT_SELECT = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  position: true,
  experienceYear: true,
  hireDate: true,
  department: { select: { name: true } },
  team: { select: { name: true } },
  assessmentSessions: {
    where: {
      OR: [
        { status: "COMPLETED" as const },
        { answers: { some: {} } },
        { dimensionScores: { not: Prisma.JsonNull } },
      ],
    },
    orderBy: [
      { completedAt: "desc" as const },
      { updatedAt: "desc" as const },
    ],
    take: 1,
    select: {
      id: true,
      status: true,
      completedAt: true,
      dimensionScores: true,
      hrPdrAnalysis: true,
      psychologicalAnalysis: true,
      swotAnalysis: true,
      careerPaths: true,
      keyInsights: true,
      assessment: { select: { title: true } },
    },
  },
};

export async function buildHrContext(
  organizationId: string,
  userQuestion: string,
): Promise<{
  contextText: string;
  metadata: Record<string, unknown>;
}> {
  const [{ ids: departmentIds, matchedNames }, mentionedIds] =
    await Promise.all([
      resolveDepartmentIdsFromQuestion(organizationId, userQuestion),
      resolvePersonnelIdsMentionedInQuestion(organizationId, userQuestion),
    ]);

  const baseWhere: Prisma.PersonnelWhereInput = {
    organizationId,
    deletedAt: null,
    status: "ACTIVE",
  };

  const scopeOr: Prisma.PersonnelWhereInput[] = [];
  if (departmentIds.length > 0) {
    scopeOr.push({ departmentId: { in: departmentIds } });
  }
  if (mentionedIds.length > 0) {
    scopeOr.push({ id: { in: mentionedIds } });
  }

  const personnelWhere: Prisma.PersonnelWhereInput =
    scopeOr.length > 0 ? { ...baseWhere, OR: scopeOr } : baseWhere;

  const departmentsOverview = await prisma.department.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: { select: { personnel: { where: { deletedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  const mentionedPersonnel =
    mentionedIds.length === 0
      ? []
      : await prisma.personnel.findMany({
          where: { ...baseWhere, id: { in: mentionedIds } },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: PERSONNEL_CONTEXT_SELECT,
        });

  const remainingSlots = MAX_PERSONNEL_IN_CONTEXT - mentionedPersonnel.length;

  const restPersonnel =
    remainingSlots <= 0
      ? []
      : await prisma.personnel.findMany({
          where: {
            ...personnelWhere,
            ...(mentionedIds.length > 0 ? { id: { notIn: mentionedIds } } : {}),
          },
          take: remainingSlots,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: PERSONNEL_CONTEXT_SELECT,
        });

  const personnel = [...mentionedPersonnel, ...restPersonnel];

  let truncated = false;
  const totalMatching = await prisma.personnel.count({ where: personnelWhere });
  if (totalMatching > personnel.length) {
    truncated = true;
  }

  const deptLines = departmentsOverview
    .map((d) => `- ${d.name}: ${d._count.personnel} personel`)
    .join("\n");

  const blocks: string[] = [];
  blocks.push(`### Departman özeti\n${deptLines || "(departman yok)"}`);
  if (departmentIds.length > 0) {
    blocks.push(
      `### Soruya göre departman filtresi\nEşleşen: ${matchedNames.join(", ") || "(yok)"}`,
    );
  }
  if (mentionedIds.length > 0) {
    blocks.push(
      `### Soruda anılan personel (metin eşlemesi)\nEşleşen kayıt sayısı: ${mentionedIds.length}`,
    );
  }
  blocks.push(
    `### Personel ve son değerlendirme oturumu özeti (${personnel.length} kayıt gösteriliyor${truncated ? ", genel liste kesildi" : ""})`,
  );

  for (const p of personnel) {
    const session = p.assessmentSessions[0];
    const name = `${p.firstName} ${p.lastName}`;
    const dept = p.department?.name ?? "(atanmamış)";
    const team = p.team?.name ?? "";
    let block = `---\n**${name}** (id: ${p.id})\n`;
    block += `- Sicil / pozisyon: ${p.employeeId} / ${p.position}\n`;
    block += `- Departman / ekip: ${dept}${team ? ` / ${team}` : ""}\n`;
    block += `- Deneyim (yıl): ${p.experienceYear}\n`;
    if (session) {
      const durumEtiket =
        session.status === "COMPLETED"
          ? ""
          : ` [oturum: ${session.status}]`;
      block += `- Son oturum${durumEtiket}: ${session.assessment.title} (${session.completedAt?.toISOString().slice(0, 10) ?? "?"})\n`;
      block += `- Boyut skorları: ${truncateForContext(session.dimensionScores)}\n`;
      block += `- HR PDR özeti: ${truncateForContext(session.hrPdrAnalysis)}\n`;
      block += `- Psikolojik özet: ${truncateForContext(session.psychologicalAnalysis)}\n`;
      block += `- SWOT: ${truncateForContext(session.swotAnalysis)}\n`;
      block += `- Kariyer yolları: ${truncateForContext(session.careerPaths)}\n`;
      if (session.keyInsights) {
        block += `- Öne çıkan içgörü: ${truncateForContext(session.keyInsights, 1200)}\n`;
      }
    } else {
      block +=
        "- Kayıtlı değerlendirme oturumu yok veya henüz tamamlanmamış / cevap ve skor içeren oturum bulunamadı.\n";
    }
    blocks.push(block);
  }

  const contextText = blocks.join("\n\n");

  return {
    contextText,
    metadata: {
      departmentFilterIds: departmentIds,
      matchedDepartmentNames: matchedNames,
      mentionedPersonnelIds: mentionedIds,
      personnelIncluded: personnel.length,
      personnelTotalMatching: totalMatching,
      truncated,
    },
  };
}

export async function generateHrAssistantReply(params: {
  organizationId: string;
  /** system hariç; son mesaj kullanıcı olmalı */
  dialogue: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{
  reply: string;
  metadata: Record<string, unknown>;
  aiProvider: AiProvider;
  modelName: string;
}> {
  const { organizationId, dialogue } = params;
  const last = dialogue[dialogue.length - 1];
  if (!last || last.role !== "user") {
    throw new Error("Sohbet sonu kullanıcı mesajı olmalıdır");
  }

  const aiConfig = await requireActiveAiConfig(organizationId);

  const { contextText, metadata: ctxMeta } = await buildHrContext(
    organizationId,
    last.content,
  );

  const systemContent = HR_ASSISTANT_SYSTEM.replace("{context}", contextText);

  const messages: LlmMessage[] = [
    { role: "system", content: systemContent },
    ...dialogue.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const apiKey = decrypt(aiConfig.encryptedApiKey);

  const reply = await completeChatMulti({
    provider: aiConfig.provider,
    apiKey,
    modelName: aiConfig.modelName,
    messages,
    responseFormat: "text",
  });

  return {
    reply,
    metadata: {
      ...ctxMeta,
      aiModel: aiConfig.modelName,
      aiProvider: aiConfig.provider,
    },
    aiProvider: aiConfig.provider,
    modelName: aiConfig.modelName,
  };
}
