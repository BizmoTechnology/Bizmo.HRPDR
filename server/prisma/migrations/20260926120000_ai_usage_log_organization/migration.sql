-- AI kullanım kayıtlarının organizasyon bazında raporlanabilmesi için
ALTER TABLE "AiUsageLog" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "AiUsageLog_organizationId_createdAt_idx" ON "AiUsageLog"("organizationId", "createdAt");

-- Mevcut kayıtları oturum veya kullanıcı üzerinden organizasyona bağla
UPDATE "AiUsageLog" AS l
SET "organizationId" = a."organizationId"
FROM "AssessmentSession" AS s
JOIN "Assessment" AS a ON a."id" = s."assessmentId"
WHERE l."organizationId" IS NULL AND l."sessionId" = s."id";

UPDATE "AiUsageLog" AS l
SET "organizationId" = u."organizationId"
FROM "User" AS u
WHERE l."organizationId" IS NULL AND l."userId" = u."id";
