import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompleteChatFormat = "json_object" | "text";

/**
 * Çoklu mesaj destekli LLM tamamlama (sohbet geçmişi + sistem prompt).
 */
export async function completeChatMulti(params: {
  provider: string;
  apiKey: string;
  modelName: string;
  messages: LlmMessage[];
  /** Varsayılan: json_object (session analizi ile uyumlu) */
  responseFormat?: CompleteChatFormat;
}): Promise<string> {
  const {
    provider,
    apiKey,
    modelName,
    messages,
    responseFormat = "json_object",
  } = params;

  const systemMsg = messages.find((m) => m.role === "system");
  const system = systemMsg?.content ?? "";
  const convo = messages.filter((m) => m.role !== "system");

  if (provider === "OPENAI") {
    const client = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) {
      openaiMessages.push({ role: "system", content: system });
    }
    for (const m of convo) {
      openaiMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
    const res = await client.chat.completions.create({
      model: modelName,
      ...(responseFormat === "json_object"
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: openaiMessages,
      temperature: 0.4,
    });
    const txt = res.choices[0]?.message?.content ?? "";
    if (!txt) throw new Error("OPENAI boş yanıt");
    return txt;
  }

  if (provider === "CLAUDE") {
    const client = new Anthropic({ apiKey });
    const claudeMessages: Anthropic.MessageParam[] = [];
    for (const m of convo) {
      claudeMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
    const res = await client.messages.create({
      model: modelName,
      max_tokens: 8192,
      system: system || "You are a helpful assistant.",
      messages: claudeMessages,
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
        ...(responseFormat === "json_object"
          ? { responseMimeType: "application/json" as const }
          : {}),
        temperature: 0.4,
      },
    });
    let prompt = "";
    if (system) prompt += `${system}\n\n`;
    for (const m of convo) {
      const label = m.role === "assistant" ? "Asistan" : "Kullanıcı";
      prompt += `[${label}]\n${m.content}\n\n`;
    }
    const res = await model.generateContent(prompt.trim());
    const txt = res.response.text();
    if (!txt) throw new Error("GEMINI boş yanıt");
    return txt;
  }

  if (provider === "ABACUS") {
    const baseUrl = (
      process.env["ABACUS_API_URL"] ?? "https://routellm.abacus.ai/v1"
    ).replace(/\/$/, "");
    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) {
      openaiMessages.push({ role: "system", content: system });
    }
    for (const m of convo) {
      openaiMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
    const res = await client.chat.completions.create({
      model: modelName,
      messages: openaiMessages,
      temperature: 0.4,
    });
    const txt = res.choices[0]?.message?.content ?? "";
    if (!txt) throw new Error("ABACUS boş yanıt");
    return txt;
  }

  throw new Error(`Desteklenmeyen sağlayıcı: ${provider}`);
}

/** Tek kullanıcı mesajı + sistem prompt (mevcut oturum analizi akışı). */
export async function completeChat(params: {
  provider: string;
  apiKey: string;
  modelName: string;
  system: string;
  user: string;
  responseFormat?: CompleteChatFormat;
}): Promise<string> {
  const { provider, apiKey, modelName, system, user, responseFormat } = params;
  return completeChatMulti({
    provider,
    apiKey,
    modelName,
    responseFormat: responseFormat ?? "json_object",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
}
