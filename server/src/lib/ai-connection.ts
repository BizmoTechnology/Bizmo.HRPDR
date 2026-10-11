import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

/** AI entegrasyonu yokken API ve arayüzün gösterdiği tek mesaj */
export const AI_NOT_CONNECTED_MESSAGE =
  "AI entegrasyonu bağlı değil. AI Yapılandırma sayfasından bir sağlayıcı bağlayın.";

/** Oturum kaydına yazılan kısa neden (analiz kuyruğa alınmadığında) */
export const AI_NOT_CONNECTED_REASON = "AI entegrasyonu bağlı değil";

/** Organizasyonun kullanılacak AI yapılandırması: aktifler içinde önce varsayılan, sonra en yeni */
export function getActiveAiConfig(organizationId: string) {
  return prisma.aiConfig.findFirst({
    where: { organizationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

/**
 * AI gerektiren her işlem bunu çağırır. Bağlı sağlayıcı yoksa sahte (mock) sonuç
 * üretilmez; istemci 409 AI_NOT_CONNECTED alır ve "bağlı değil" uyarısı gösterir.
 */
export async function requireActiveAiConfig(organizationId: string) {
  const config = await getActiveAiConfig(organizationId);
  if (!config) throw new HttpError(AI_NOT_CONNECTED_MESSAGE, 409, "AI_NOT_CONNECTED");
  return config;
}
