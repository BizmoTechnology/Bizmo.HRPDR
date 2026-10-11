-- MOCK sağlayıcı kaldırıldı: AI entegrasyonu bağlı değilken sahte analiz üretilmez,
-- panel "AI entegrasyonu bağlı değil" uyarısı gösterir.

-- MOCK ile üretilmiş analizler ve onlardan türeyen inceleme/rapor kayıtları silinir;
-- oturumlar "bağlı değil" durumuna döner (skala skorları korunur).
DELETE FROM "Report"
WHERE "sessionId" IN (SELECT "id" FROM "AssessmentSession" WHERE "analysisModel" LIKE 'MOCK:%');

DELETE FROM "AnalysisReview"
WHERE "sessionId" IN (SELECT "id" FROM "AssessmentSession" WHERE "analysisModel" LIKE 'MOCK:%');

UPDATE "AssessmentSession"
SET "hrPdrAnalysis" = NULL,
    "psychologicalAnalysis" = NULL,
    "rawAnalysis" = NULL,
    "keyInsights" = NULL,
    "swotAnalysis" = NULL,
    "careerPaths" = NULL,
    "analysisModel" = NULL,
    "analysisPipeline" = 'NOT_QUEUED',
    "analysisError" = 'AI entegrasyonu bağlı değil'
WHERE "analysisModel" LIKE 'MOCK:%';

DELETE FROM "AiUsageLog" WHERE "provider" = 'MOCK';
DELETE FROM "AiConfig" WHERE "provider" = 'MOCK';

-- AlterEnum
BEGIN;
CREATE TYPE "AiProvider_new" AS ENUM ('CLAUDE', 'OPENAI', 'GEMINI', 'ABACUS');
ALTER TABLE "AiConfig" ALTER COLUMN "provider" TYPE "AiProvider_new" USING ("provider"::text::"AiProvider_new");
ALTER TABLE "AiUsageLog" ALTER COLUMN "provider" TYPE "AiProvider_new" USING ("provider"::text::"AiProvider_new");
ALTER TYPE "AiProvider" RENAME TO "AiProvider_old";
ALTER TYPE "AiProvider_new" RENAME TO "AiProvider";
DROP TYPE "AiProvider_old";
COMMIT;
