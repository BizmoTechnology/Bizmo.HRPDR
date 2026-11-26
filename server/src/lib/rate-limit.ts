/**
 * Ücretli LLM çağrısı yapan uç noktalar için kullanıcı başına dakikalık sınır
 * (`authenticate` sonrasında `request.user` doludur; yoksa IP kullanılır).
 * Kullanım: `{ config: aiRateLimit("ai-generate") }`
 */
export function aiRateLimit(name: string, max = 10) {
  return {
    rateLimit: {
      max,
      timeWindow: "1 minute",
      keyGenerator: (request: { user?: { sub?: string } | null; ip: string }) =>
        `${name}:${request.user?.sub ?? request.ip}`,
    },
  };
}
