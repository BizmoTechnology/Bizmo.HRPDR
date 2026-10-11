import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decrypt } from "../lib/crypto.js";
import { requireActiveAiConfig } from "../lib/ai-connection.js";
import { normalizeQuestionOptions } from "../lib/question-options.js";

const generatedQuestionSchema = z.object({
  text: z.string().min(5).max(2000),
  subText: z.string().max(1000).optional(),
  type: z.enum(["OPEN_ENDED", "SITUATIONAL", "BEHAVIORAL", "SCALE", "MULTIPLE_CHOICE"]),
  phase: z.enum(["ICEBREAKER", "CORE", "CLOSING"]),
  weight: z.number().min(0).max(10).optional().default(1.0),
  followUpPrompt: z.string().max(2000).optional(),
  options: z.any().optional(),
  minScale: z.number().int().optional(),
  maxScale: z.number().int().optional(),
  tags: z.array(z.string()).optional().default([]),
});

const aiOutputSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(20),
});

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
      temperature: 0.7,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "CLAUDE") {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: modelName,
      max_tokens: 8192,
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
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    });
    const res = await model.generateContent(`${system}\n\n${user}`);
    return res.response.text();
  }

  if (provider === "ABACUS") {
    const baseUrl = (process.env["ABACUS_API_URL"] ?? "https://routellm.abacus.ai/v1").replace(/\/$/, "");
    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    const res = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  throw new Error(`Desteklenmeyen sağlayıcı: ${provider}`);
}

const DIMENSION_INFO: Record<string, { tr: string; description: string }> = {
  LOGICAL_ALGORITHMIC: {
    tr: "Mantıksal / Algoritmik",
    description: "Sistematik düşünme, örüntü tanıma, adım adım akıl yürütme, hata kök nedeni analizi",
  },
  LEADERSHIP: {
    tr: "Liderlik",
    description: "Sorumluluk alma, ekip etkisi, inisiyatif, çatışma yönetimi, yönlendirme",
  },
  SOCIAL_INTELLIGENCE: {
    tr: "Sosyal Zeka",
    description: "Empati, iletişim kalitesi, güven inşası, ikna ve iş birliği",
  },
  GROWTH_POTENTIAL: {
    tr: "Büyüme Potansiyeli",
    description: "Öğrenme iştahı, değişime uyum, geri bildirimden yararlanma, gelişime açıklık",
  },
  DOMAIN_ALIGNMENT: {
    tr: "Alan Uyumu",
    description: "Rol, ortam ve sorumluluk uyumu; kariyer yönelimi",
  },
};

const TYPE_INFO: Record<string, string> = {
  OPEN_ENDED: "Açık uçlu — serbest metin cevabı beklenir",
  SITUATIONAL: "Durumsal — varsayımsal bir senaryo sunulur",
  BEHAVIORAL: "Davranışsal — geçmiş deneyimlerden örnek istenir",
  SCALE: "Skala — 1-10 arası sayısal değerlendirme",
  MULTIPLE_CHOICE: "Çoktan seçmeli — önceden tanımlı seçeneklerden biri seçilir",
};

export async function generateAiQuestions(params: {
  organizationId: string;
  dimension: string;
  questionTypes?: string[];
  count: number;
  context?: string;
  language?: string;
}): Promise<Array<Record<string, unknown>>> {
  const { organizationId, dimension, questionTypes, count, context, language = "tr" } = params;

  const dimInfo = DIMENSION_INFO[dimension];
  if (!dimInfo) throw new Error(`Geçersiz boyut: ${dimension}`);

  const aiConfig = await requireActiveAiConfig(organizationId);

  const apiKey = decrypt(aiConfig.encryptedApiKey);

  const typeConstraint = questionTypes && questionTypes.length > 0
    ? `Soru tipleri YALNIZCA şunlardan biri olmalı: ${questionTypes.map((t) => `${t} (${TYPE_INFO[t] ?? t})`).join(", ")}`
    : `Soru tipleri: ${Object.entries(TYPE_INFO).map(([k, v]) => `${k} (${v})`).join("; ")}`;

  const system = `Sen bir İK potansiyel değerlendirme ve psikoloji uzmanısın. Görevin: belirtilen boyut ve kriterlere göre özgün değerlendirme soruları üretmek.

Kurallar:
- Çıktı YALNIZCA geçerli bir JSON nesnesi olmalı (markdown yok).
- JSON formatı: { "questions": [...] }
- Her soru nesnesi şu alanları içermeli:
  - "text": string (soru metni, ${language === "tr" ? "Türkçe" : language})
  - "subText": string (isteğe bağlı alt açıklama)
  - "type": enum — ${typeConstraint}
  - "phase": enum — ICEBREAKER (buz kırma), CORE (ana değerlendirme), CLOSING (kapanış). Çoğu soru CORE olmalı.
  - "weight": number (0-10 arası, varsayılan 1.0)
  - "followUpPrompt": string (isteğe bağlı; takip sorusu için yönlendirme metni)
  - "tags": string[] (etiketler)
  - SCALE tipi için ek: "minScale": 1, "maxScale": 10
  - MULTIPLE_CHOICE tipi için ek: "options": [{ "key": "A", "label": "..." }, ...]

- Sorular özgün, düşündürücü ve değerlendirmeye uygun olmalı.
- Endüstriyel İK, performans değerlendirme ve organizasyonel psikoloji bilgini kullan.
- Soruları farklı zorluk seviyelerinde üret.
- Her soru, belirtilen boyutun farklı alt yönlerini ölçmeli.`;

  const userPayload = JSON.stringify({
    boyut: `${dimension} — ${dimInfo.tr}: ${dimInfo.description}`,
    soru_adedi: count,
    ...(context ? { ek_baglamcontext: context } : {}),
    dil: language,
  });

  const raw = await completeChat({
    provider: aiConfig.provider,
    apiKey,
    modelName: aiConfig.modelName,
    system,
    user: userPayload,
  });

  if (!raw) throw new Error("AI boş yanıt döndü");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("AI yanıtı geçerli JSON değil");
  }

  const validated = aiOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI çıktısı doğrulanamadı: ${validated.error.issues.map((e) => e.message).join(", ")}`);
  }

  const savedQuestions: Array<Record<string, unknown>> = [];

  for (const q of validated.data.questions) {
    const question = await prisma.question.create({
      data: {
        text: q.text,
        subText: q.subText ?? null,
        dimension: dimension as any,
        type: q.type as any,
        phase: q.phase as any,
        weight: q.weight,
        followUpPrompt: q.followUpPrompt ?? null,
        options: normalizeQuestionOptions(q.options) ?? Prisma.DbNull,
        minScale: q.type === "SCALE" ? (q.minScale ?? 1) : null,
        maxScale: q.type === "SCALE" ? (q.maxScale ?? 10) : null,
        isActive: true,
        isAiGenerated: true,
        aiModel: aiConfig.modelName,
        tags: q.tags ?? [],
        language,
        organizationId,
      },
    });
    savedQuestions.push(question as unknown as Record<string, unknown>);
  }

  await prisma.aiUsageLog.create({
    data: {
      provider: aiConfig.provider,
      modelName: aiConfig.modelName,
      purpose: "question_generation",
      requestType: "question_ai_generate",
      status: "SUCCESS",
      organizationId,
      metadata: { dimension, count: savedQuestions.length } as any,
    },
  });

  return savedQuestions;
}

