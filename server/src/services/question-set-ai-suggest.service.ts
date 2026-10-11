import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { decrypt } from "../lib/crypto.js";
import { requireActiveAiConfig } from "../lib/ai-connection.js";

const aiOutputSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  weightLogical: z.number().min(0).optional(),
  weightLeadership: z.number().min(0).optional(),
  weightSocial: z.number().min(0).optional(),
  weightGrowth: z.number().min(0).optional(),
  weightDomain: z.number().min(0).optional(),
  questionIds: z.array(z.string().min(1)).max(80).optional().default([]),
});

export type QuestionSetAiSuggestDto = z.infer<typeof aiOutputSchema>;

function fillDefaultWeights(d: QuestionSetAiSuggestDto): QuestionSetAiSuggestDto {
  const def = 20;
  return {
    ...d,
    weightLogical: d.weightLogical ?? def,
    weightLeadership: d.weightLeadership ?? def,
    weightSocial: d.weightSocial ?? def,
    weightGrowth: d.weightGrowth ?? def,
    weightDomain: d.weightDomain ?? def,
  };
}

function extractJson(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(t);
  if (fence?.[1]) t = fence[1].trim();
  return t;
}

async function completeChat(params: {
  provider: string;
  apiKey: string;
  modelName: string;
  system: string;
  user: string;
}): Promise<string> {
  const { provider, apiKey, modelName, system, user } = params;

  if (provider === "OPENAI") {
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model: modelName,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    });
    const txt = res.choices[0]?.message?.content ?? "";
    if (!txt) throw new Error("OPENAI boş yanıt");
    return txt;
  }

  if (provider === "CLAUDE") {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: modelName,
      max_tokens: 4096,
      messages: [{ role: "user", content: `${system}\n\n---\n\n${user}` }],
    });
    const block = res.content[0];
    if (block?.type !== "text") throw new Error("CLAUDE beklenmeyen içerik");
    return block.text;
  }

  if (provider === "GEMINI") {
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });
    const res = await model.generateContent(`${system}\n\n${user}`);
    const txt = res.response.text();
    if (!txt) throw new Error("GEMINI boş yanıt");
    return txt;
  }

  if (provider === "ABACUS") {
    // RouteLLM OpenAI uyumlu API: self-serve https://routellm.abacus.ai/v1
    // Kurumsal: https://<workspace>.abacus.ai/v1 — api.abacus.ai/v1 chat için 404 verir.
    const baseUrl = (
      process.env["ABACUS_API_URL"] ?? "https://routellm.abacus.ai/v1"
    ).replace(/\/$/, "");
    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    const res = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    });
    const txt = res.choices[0]?.message?.content ?? "";
    if (!txt) throw new Error("ABACUS boş yanıt");
    return txt;
  }

  throw new Error(
    `Desteklenmeyen sağlayıcı: ${provider}. OPENAI, CLAUDE, GEMINI veya ABACUS kullanın.`,
  );
}

export async function suggestQuestionSetFromAi(params: {
  organizationId: string;
  brief: string;
  maxQuestions: number;
}): Promise<QuestionSetAiSuggestDto> {
  const { organizationId, brief, maxQuestions } = params;

  const questions = await prisma.question.findMany({
    where: { organizationId, deletedAt: null, isActive: true },
    take: 200,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      text: true,
      dimension: true,
      type: true,
      phase: true,
    },
  });

  if (questions.length === 0) {
    throw new Error(
      "Soru bankası boş. Önce Sorular bölümünden soru ekleyin veya içe aktarın.",
    );
  }

  const aiConfig = await requireActiveAiConfig(organizationId);

  const apiKey = decrypt(aiConfig.encryptedApiKey);

  const catalog = questions.map((q, i) => ({
    id: q.id,
    text:
      q.text.length > 280 ? `${q.text.slice(0, 277)}...` : q.text,
    dimension: q.dimension,
    type: q.type,
    phase: q.phase,
  }));

  const allowedIds = new Set(questions.map((q) => q.id));

  const system = `Sen bir İK potansiyel değerlendirme uzmanısın. Görevin: verilen soru havuzundan YALNIZCA liste içindeki "id" değerlerini seçerek bir soru seti önermek.
Kurallar:
- Çıktı YALNIZCA geçerli bir JSON nesnesi olmalı (markdown yok).
- Alanlar: name (string), description (string, isteğe bağlı), weightLogical, weightLeadership, weightSocial, weightGrowth, weightDomain (0-100 arası sayılar; dengeli dağılım öner).
- questionIds: seçilen soru id dizisi; en fazla ${maxQuestions} adet, en az 3 adet mümkünse.
- Her id mutlaka verilen katalogdaki id ile birebir aynı olmalı.
- Türkçe ad ve açıklama yaz.`;

  const userPayload = JSON.stringify(
    {
      kullanici_istegi: brief,
      soru_katalogu: catalog,
      max_adet: maxQuestions,
    },
    null,
    0,
  );

  const raw = await completeChat({
    provider: aiConfig.provider,
    apiKey,
    modelName: aiConfig.modelName,
    system,
    user: userPayload,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("AI yanıtı geçerli JSON değil");
  }

  const base = aiOutputSchema.safeParse(parsed);
  if (!base.success) {
    throw new Error(
      `AI çıktısı doğrulanamadı: ${base.error.issues.map((e) => e.message).join(", ")}`,
    );
  }

  const filled = fillDefaultWeights(base.data);
  const filteredIds = filled.questionIds.filter((id) => allowedIds.has(id));
  const uniqueIds = [...new Set(filteredIds)].slice(0, maxQuestions);

  if (uniqueIds.length === 0) {
    const fallback = questions.slice(0, Math.min(maxQuestions, 12)).map((q) => q.id);
    return {
      ...filled,
      questionIds: fallback,
      description:
        (filled.description ? `${filled.description}\n\n` : "") +
        "(Uyarı: AI geçerli soru seçemedi; havuzdan ilk uygun sorular otomatik atandı.)",
    };
  }

  return { ...filled, questionIds: uniqueIds };
}
