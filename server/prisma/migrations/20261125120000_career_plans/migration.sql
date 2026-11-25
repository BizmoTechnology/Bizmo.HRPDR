-- CreateEnum
CREATE TYPE "CareerPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CareerPlan" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "CareerPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "targetRole" TEXT,
    "horizonMonths" INTEGER NOT NULL DEFAULT 12,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "aiSuggestion" JSONB,
    "aiModel" TEXT,
    "aiSuggestedAt" TIMESTAMP(3),
    "sourceSummary" JSONB,
    "shareWithEmployee" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 1,
    "basedOnVersion" INTEGER,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerPlan_organizationId_personnelId_idx" ON "CareerPlan"("organizationId", "personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerPlan_personnelId_version_key" ON "CareerPlan"("personnelId", "version");

-- AddForeignKey
ALTER TABLE "CareerPlan" ADD CONSTRAINT "CareerPlan_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

