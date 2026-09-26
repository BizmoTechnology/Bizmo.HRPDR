import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decrypt } from "../lib/crypto.js";
import { HttpError } from "../lib/http-error.js";
import { completeChat } from "../lib/llm.js";
import { normalizeQuestionOptions } from "../lib/question-options.js";
import {
  mergeDimensionScores,
  readDimensionScores,
  scoresFromHrPdrAnalysis,
} from "./scoring.service.js";

const DEFAULT_HR_PDR_PROMPT = `Sen deneyimli bir İnsan Kaynakları uzmanısın. Görevin, bir çalışanın performans değerlendirme oturumundaki cevaplarını analiz ederek kapsamlı bir HR PDR (Performans Değerlendirme Raporu) hazırlamaktır.

Analiz kapsamı:
1. **Performans Özeti**: Genel performans değerlendirmesi (1-10 arası puan ve açıklama)
2. **Yetkinlik Analizi**: Her boyut için (Mantıksal/Algoritmik, Liderlik, Sosyal Zeka, Gelişim Potansiyeli, Alan Uyumu) güçlü ve gelişime açık yönler
3. **Güçlü Yönler**: En az 3 güçlü yön
4. **Gelişim Alanları**: En az 3 gelişim alanı ve öneriler
5. **Hedef Önerileri**: Kısa vadeli (3 ay), orta vadeli (6 ay), uzun vadeli (1 yıl) hedef önerileri
6. **Genel Değerlendirme**: Terfi/yatay geçiş/eğitim önerileri

Her boyut için competencyAnalysis içinde bir kayıt üret; "dimension" alanında yalnızca belirtilen İngilizce anahtarları kullan, "score" 0-10 arasında olsun.

Çıktı YALNIZCA geçerli bir JSON nesnesi olmalı:
{
  "performanceScore": number,
  "performanceSummary": string,
  "competencyAnalysis": [{ "dimension": "LOGICAL_ALGORITHMIC" | "LEADERSHIP" | "SOCIAL_INTELLIGENCE" | "GROWTH_POTENTIAL" | "DOMAIN_ALIGNMENT", "score": number (0-10), "strengths": string[], "improvements": string[] }],
  "strengths": string[],
  "developmentAreas": [{ "area": string, "recommendation": string }],
  "goals": { "shortTerm": string[], "midTerm": string[], "longTerm": string[] },
  "overallRecommendation": string,
  "promotionReadiness": "READY" | "DEVELOPING" | "NOT_READY",
  "trainingNeeds": string[]
}`;

const DEFAULT_PSYCHOLOGICAL_PROMPT = `Sen deneyimli bir endüstriyel/örgütsel psikologsun. Görevin, bir çalışanın değerlendirme oturumundaki cevaplarını psikolojik açıdan analiz etmektir.

Analiz kapsamı:
1. **Kişilik Profili**: Big Five modeline göre kişilik özelliklerinin tahmini değerlendirmesi
2. **Duygusal Zeka**: Duygusal zeka boyutlarının analizi
3. **Stres & Başa Çıkma**: Stres yönetimi ve başa çıkma stratejileri
4. **Motivasyon Profili**: İçsel ve dışsal motivasyon kaynakları
5. **Ekip Dinamikleri**: Takım içi rol eğilimi ve işbirliği tarzı
6. **İletişim Tarzı**: Baskın iletişim tarzı ve etkinliği
7. **Karar Verme**: Karar verme tarzı ve risk eğilimi
8. **Psikolojik Dayanıklılık**: Psikolojik sağlamlık değerlendirmesi

Çıktı YALNIZCA geçerli bir JSON nesnesi olmalı:
{
  "personalityProfile": {
    "openness": { "score": number, "description": string },
    "conscientiousness": { "score": number, "description": string },
    "extraversion": { "score": number, "description": string },
    "agreeableness": { "score": number, "description": string },
    "neuroticism": { "score": number, "description": string }
  },
  "emotionalIntelligence": {
    "selfAwareness": number,
    "selfRegulation": number,
    "motivation": number,
    "empathy": number,
    "socialSkills": number,
    "summary": string
  },
  "stressManagement": { "level": "LOW" | "MODERATE" | "HIGH", "copingStrategies": string[], "recommendations": string[] },
  "motivationProfile": { "intrinsic": string[], "extrinsic": string[], "summary": string },
  "teamDynamics": { "role": string, "collaborationStyle": string, "strengths": string[], "challenges": string[] },
  "communicationStyle": { "primary": string, "effectiveness": number, "suggestions": string[] },
  "decisionMaking": { "style": string, "riskTolerance": "LOW" | "MODERATE" | "HIGH", "description": string },
  "resilience": { "score": number, "description": string, "recommendations": string[] },
  "overallPsychologicalProfile": string
}`;

export function extractJson(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(t);
  if (fence?.[1]) t = fence[1].trim();
  return t;
}

function formatAnswersForAi(answers: Array<{
  question: {
    text: string;
    dimension: string;
    type: string;
    phase: string;
    options: Prisma.JsonValue;
    maxScale: number | null;
  } | null;
  textAnswer: string | null;
  scaleValue: number | null;
  choiceKey: string | null;
  followUpAnswer: string | null;
}>): string {
  return answers
    .filter((a) => a.question)
    .map((a, i) => {
      let answer = "";
      if (a.textAnswer) answer = a.textAnswer;
      else if (a.scaleValue !== null) answer = `Puan: ${a.scaleValue}/${a.question!.maxScale ?? 10}`;
      else if (a.choiceKey) {
        const label = normalizeQuestionOptions(a.question!.options)?.[a.choiceKey];
        answer = `Seçim: ${a.choiceKey}${label ? ` — ${label}` : ""}`;
      }
      else answer = "(Cevap verilmedi)";

      let followUp = "";
      if (a.followUpAnswer) followUp = `\n   Takip Cevabı: ${a.followUpAnswer}`;

      return `${i + 1}. [${a.question!.dimension}/${a.question!.type}] ${a.question!.text}\n   Cevap: ${answer}${followUp}`;
    })
    .join("\n\n");
}

/**
 * Oturum için AI analizi rızası var mı?
 * - AI_ASSESSMENT: yeni portal akışında ayrı onay kutusu.
 * - ASSESSMENT_CONSENT: eski portal akışı; AI onay kutusu zorunluydu ve bu kayıt
 *   yazılıyordu, bu yüzden AI rızası sayılır.
 * - Hiç rıza kaydı olmayan eski/seed oturumlar geriye dönük uyumluluk için hariç.
 */
export async function hasAiConsent(sessionId: string): Promise<boolean> {
  const consents = await prisma.consentRecord.findMany({
    where: { sessionId },
    select: { consentType: true, accepted: true },
  });
  if (consents.length === 0) return true;
  return consents.some(
    (c) =>
      c.accepted &&
      (c.consentType === "AI_ASSESSMENT" || c.consentType === "ASSESSMENT_CONSENT"),
  );
}

export function getActiveAiConfig(organizationId: string) {
  return prisma.aiConfig.findFirst({
    where: { organizationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function runSessionAnalysis(params: {
  sessionId: string;
  organizationId: string;
  analysisType: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS";
}): Promise<Record<string, unknown>> {
  const { sessionId, organizationId, analysisType } = params;

  const session = await prisma.assessmentSession.findFirst({
    where: { id: sessionId, assessment: { organizationId } },
    include: {
      personnel: {
        select: { firstName: true, lastName: true, position: true, experienceYear: true },
      },
      answers: {
        orderBy: { answeredAt: "asc" },
        include: {
          question: {
            select: {
              text: true,
              dimension: true,
              type: true,
              phase: true,
              options: true,
              maxScale: true,
            },
          },
        },
      },
      assessment: { select: { title: true } },
    },
  });

  if (!session) throw new HttpError("Oturum bulunamadı", 404, "NOT_FOUND");

  let answersFormatted = formatAnswersForAi(session.answers);
  if (!answersFormatted.trim()) {
    const ds = session.dimensionScores;
    const hasScores =
      ds &&
      typeof ds === "object" &&
      Object.keys(ds as Record<string, unknown>).length > 0;
    if (hasScores) {
      answersFormatted =
        "(Bu oturumda soru metni cevapları veritabanında yok; boyut skorları ve özet kullanılıyor.)\n\n" +
        `Boyut skorları: ${JSON.stringify(ds)}\n` +
        (session.keyInsights ? `\nÖne çıkan içgörü: ${session.keyInsights}` : "");
    }
  }
  if (!answersFormatted.trim()) {
    throw new HttpError(
      "Bu oturumda analiz için veri yok: kayıtlı soru cevabı veya boyut skoru bulunamadı.",
      400,
      "NO_SESSION_DATA",
    );
  }

  // KVKK (development.md §12.3): AI analizi yalnızca AI rızası varsa çalışır.
  if (!(await hasAiConsent(sessionId))) {
    throw new HttpError(
      "Personel AI destekli değerlendirmeye rıza vermediği için analiz çalıştırılamaz.",
      403,
      "AI_CONSENT_MISSING",
    );
  }

  const aiConfig = await getActiveAiConfig(organizationId);

  if (!aiConfig) {
    throw new HttpError(
      "Aktif AI yapılandırması yok. AI Yapılandırması sayfasından bir sağlayıcı ekleyin.",
      400,
      "NO_AI_CONFIG",
    );
  }

  const promptTemplate = await prisma.aiPromptTemplate.findFirst({
    where: { organizationId, type: analysisType, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  const systemPrompt = promptTemplate?.systemPrompt ??
    (analysisType === "HR_PDR_ANALYSIS" ? DEFAULT_HR_PDR_PROMPT : DEFAULT_PSYCHOLOGICAL_PROMPT);

  const apiKey = aiConfig.provider === "MOCK" ? "" : decrypt(aiConfig.encryptedApiKey);

  const personnelInfo = `Personel: ${session.personnel.firstName} ${session.personnel.lastName}
Pozisyon: ${session.personnel.position}
Deneyim: ${session.personnel.experienceYear} yıl
Değerlendirme: ${session.assessment.title}`;

  const userMessage = `${personnelInfo}\n\n--- CEVAPLAR ---\n\n${answersFormatted}`;

  const field = analysisType === "HR_PDR_ANALYSIS" ? "hrPdrAnalysis" : "psychologicalAnalysis";
  let parsed: Record<string, unknown>;

  if (aiConfig.provider === "MOCK") {
    parsed = analysisType === "HR_PDR_ANALYSIS"
      ? generateMockHrPdr(session.personnel)
      : generateMockPsychological(session.personnel);
  } else {
    const startedAt = Date.now();
    let raw: string;
    try {
      raw = await completeChat({
        provider: aiConfig.provider,
        apiKey,
        modelName: aiConfig.modelName,
        system: systemPrompt,
        user: userMessage,
      });
    } catch (err) {
      await logUsage({
        aiConfig,
        organizationId,
        sessionId,
        purpose: analysisType,
        status: "FAILED",
        latencyMs: Date.now() - startedAt,
        errorCode: err instanceof Error ? err.name : "UNKNOWN",
      });
      throw err;
    }

    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      await logUsage({
        aiConfig,
        organizationId,
        sessionId,
        purpose: analysisType,
        status: "FAILED",
        latencyMs: Date.now() - startedAt,
        errorCode: "AI_INVALID_JSON",
      });
      throw new HttpError("AI yanıtı geçerli JSON değil", 502, "AI_INVALID_JSON");
    }

    await logUsage({
      aiConfig,
      organizationId,
      sessionId,
      purpose: analysisType,
      status: "SUCCESS",
      latencyMs: Date.now() - startedAt,
    });
  }

  const data: Prisma.AssessmentSessionUpdateInput = {
    [field]: parsed as Prisma.InputJsonValue,
    analysisModel: `${aiConfig.provider}:${aiConfig.modelName}`,
  };

  if (analysisType === "HR_PDR_ANALYSIS") {
    Object.assign(data, deriveFieldsFromHrPdr(session, parsed));
  }

  await prisma.assessmentSession.update({ where: { id: sessionId }, data });

  return parsed;
}

/**
 * HR PDR çıktısından boyut skorları, SWOT, kariyer yolu ve özet üretir.
 * Mevcut (ör. İK tarafından girilmiş) SWOT/kariyer/özet alanları ezilmez.
 */
function deriveFieldsFromHrPdr(
  session: {
    dimensionScores: Prisma.JsonValue;
    swotAnalysis: Prisma.JsonValue;
    careerPaths: Prisma.JsonValue;
    keyInsights: string | null;
  },
  analysis: Record<string, unknown>,
): Prisma.AssessmentSessionUpdateInput {
  const out: Prisma.AssessmentSessionUpdateInput = {};

  const aiScores = scoresFromHrPdrAnalysis(analysis);
  if (Object.keys(aiScores).length > 0) {
    out.dimensionScores = mergeDimensionScores(
      readDimensionScores(session.dimensionScores),
      aiScores,
    ) as Prisma.InputJsonValue;
  }

  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  if (!session.swotAnalysis) {
    const developmentAreas = Array.isArray(analysis["developmentAreas"])
      ? (analysis["developmentAreas"] as Array<{ area?: unknown }>)
          .map((d) => (typeof d?.area === "string" ? d.area : null))
          .filter((x): x is string => !!x)
      : [];
    out.swotAnalysis = {
      strengths: strings(analysis["strengths"]),
      weaknesses: developmentAreas,
      opportunities: strings(analysis["trainingNeeds"]),
      threats: [],
    };
  }

  const goals = analysis["goals"] as Record<string, unknown> | undefined;
  if (!session.careerPaths && goals && typeof goals === "object") {
    out.careerPaths = {
      shortTerm: strings(goals["shortTerm"]).join(" "),
      midTerm: strings(goals["midTerm"]).join(" "),
      longTerm: strings(goals["longTerm"]).join(" "),
    };
  }

  if (!session.keyInsights && typeof analysis["performanceSummary"] === "string") {
    out.keyInsights = analysis["performanceSummary"];
  }

  return out;
}

async function logUsage(params: {
  aiConfig: { provider: Prisma.AiUsageLogCreateInput["provider"]; modelName: string };
  organizationId: string;
  sessionId: string;
  purpose: string;
  status: "SUCCESS" | "FAILED";
  latencyMs: number;
  errorCode?: string;
}) {
  try {
    await prisma.aiUsageLog.create({
      data: {
        provider: params.aiConfig.provider,
        modelName: params.aiConfig.modelName,
        purpose: params.purpose,
        requestType: "session_analysis",
        status: params.status,
        latencyMs: params.latencyMs,
        errorCode: params.errorCode ?? null,
        sessionId: params.sessionId,
        organizationId: params.organizationId,
      },
    });
  } catch {
    // Kullanım logu yazılamaması analizi başarısız saymamalı
  }
}

/** Bu süreden eski QUEUED/RUNNING kayıtlar yarıda kalmış sayılır (süreç yeniden başladı vb.). */
const STALE_ANALYSIS_MS = 10 * 60 * 1000;

/**
 * Sunucu yeniden başladığında veya kuyruğa alma adımı başarısız olduğunda
 * QUEUED/RUNNING'de kalan oturumları yeniden kuyruğa alır.
 */
export async function requeueStaleAnalyses(log: {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}): Promise<void> {
  const stale = await prisma.assessmentSession.findMany({
    where: {
      status: "COMPLETED",
      analysisPipeline: { in: ["QUEUED", "RUNNING"] },
      updatedAt: { lt: new Date(Date.now() - STALE_ANALYSIS_MS) },
    },
    select: { id: true, assessment: { select: { organizationId: true } } },
    take: 50,
  });
  for (const s of stale) {
    queueSessionAnalysis(s.id, s.assessment.organizationId, log);
  }
  if (stale.length > 0) {
    log.info({ count: stale.length }, "stale session analyses requeued");
  }
}

/**
 * Oturum tamamlandığında çağrılır: HR PDR analizini arka planda çalıştırır ve
 * `analysisPipeline` durumunu günceller. İstek yanıtını bekletmez.
 */
export function queueSessionAnalysis(
  sessionId: string,
  organizationId: string,
  log: { error: (obj: unknown, msg?: string) => void },
): void {
  setImmediate(() => {
    void (async () => {
      await prisma.$transaction([
        prisma.assessmentSession.update({
          where: { id: sessionId },
          data: { analysisPipeline: "RUNNING", analysisError: null },
        }),
        prisma.sessionEvent.create({
          data: { sessionId, type: "ANALYSIS_QUEUED" },
        }),
      ]);

      try {
        await runSessionAnalysis({
          sessionId,
          organizationId,
          analysisType: "HR_PDR_ANALYSIS",
        });
        await prisma.$transaction([
          prisma.assessmentSession.update({
            where: { id: sessionId },
            data: { analysisPipeline: "COMPLETED" },
          }),
          prisma.sessionEvent.create({
            data: { sessionId, type: "ANALYSIS_COMPLETED" },
          }),
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI analizi başarısız";
        log.error({ err, sessionId }, "background session analysis failed");
        await prisma.$transaction([
          prisma.assessmentSession.update({
            where: { id: sessionId },
            data: { analysisPipeline: "FAILED", analysisError: message.slice(0, 1000) },
          }),
          prisma.sessionEvent.create({
            data: { sessionId, type: "ANALYSIS_FAILED", payload: { message: message.slice(0, 500) } },
          }),
        ]);
      }
    })().catch((err) => log.error({ err, sessionId }, "analysis pipeline update failed"));
  });
}

function generateMockHrPdr(personnel: { firstName: string; lastName: string }) {
  return {
    performanceScore: 7.5,
    performanceSummary: `${personnel.firstName} ${personnel.lastName} genel olarak iyi bir performans göstermektedir. (MOCK analiz)`,
    competencyAnalysis: [
      { dimension: "LOGICAL_ALGORITHMIC", score: 7, strengths: ["Analitik düşünme"], improvements: ["Karmaşık problem çözme"] },
      { dimension: "LEADERSHIP", score: 8, strengths: ["Takım motivasyonu"], improvements: ["Stratejik planlama"] },
    ],
    strengths: ["İletişim becerileri", "Takım çalışması", "Öğrenme istekliliği"],
    developmentAreas: [
      { area: "Teknik beceriler", recommendation: "İleri düzey eğitimler önerilir" },
      { area: "Zaman yönetimi", recommendation: "Önceliklendirme teknikleri geliştirilmeli" },
    ],
    goals: {
      shortTerm: ["Mevcut projeleri zamanında tamamlama"],
      midTerm: ["Liderlik eğitimi programına katılma"],
      longTerm: ["Kıdemli pozisyona hazırlanma"],
    },
    overallRecommendation: "Gelişim potansiyeli yüksek, eğitim desteklenmeli. (MOCK — gerçek analiz için AI sağlayıcısı yapılandırın)",
    promotionReadiness: "DEVELOPING",
    trainingNeeds: ["Liderlik geliştirme", "Stratejik düşünme"],
  };
}

function generateMockPsychological(personnel: { firstName: string; lastName: string }) {
  return {
    personalityProfile: {
      openness: { score: 7, description: "Yeni deneyimlere açık" },
      conscientiousness: { score: 8, description: "Düzenli ve sorumluluk sahibi" },
      extraversion: { score: 6, description: "Dengeli sosyal etkileşim" },
      agreeableness: { score: 7, description: "İşbirlikçi yaklaşım" },
      neuroticism: { score: 4, description: "Duygusal olarak kararlı" },
    },
    emotionalIntelligence: {
      selfAwareness: 7, selfRegulation: 7, motivation: 8, empathy: 7, socialSkills: 7,
      summary: `${personnel.firstName} ${personnel.lastName} ortalama üstü duygusal zekaya sahiptir. (MOCK)`,
    },
    stressManagement: { level: "MODERATE", copingStrategies: ["Problem odaklı başa çıkma"], recommendations: ["Mindfulness pratikleri"] },
    motivationProfile: { intrinsic: ["Öğrenme", "Başarı"], extrinsic: ["Kariyer gelişimi"], summary: "İçsel motivasyon baskın" },
    teamDynamics: { role: "Koordinatör", collaborationStyle: "Katılımcı", strengths: ["İletişim"], challenges: ["Delegasyon"] },
    communicationStyle: { primary: "Diplomatik", effectiveness: 7, suggestions: ["Daha doğrudan geri bildirim"] },
    decisionMaking: { style: "Analitik", riskTolerance: "MODERATE", description: "Veri odaklı karar verme" },
    resilience: { score: 7, description: "İyi psikolojik dayanıklılık", recommendations: ["Stres yönetimi eğitimi"] },
    overallPsychologicalProfile: "Dengeli kişilik profili, gelişim potansiyeli mevcut. (MOCK — gerçek analiz için AI sağlayıcısı yapılandırın)",
  };
}

export { DEFAULT_HR_PDR_PROMPT, DEFAULT_PSYCHOLOGICAL_PROMPT };
