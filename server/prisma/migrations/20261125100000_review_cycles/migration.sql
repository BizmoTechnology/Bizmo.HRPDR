-- 360° değerlendirme (Aşama 1): org şeması için Personnel.managerId ve
-- dönem / değerlendirilen / atama / cevap tabloları. Mevcut HR/PDR tablolarına dokunulmaz.

-- CreateEnum
CREATE TYPE "ReviewFrequency" AS ENUM ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'ADHOC');

-- CreateEnum
CREATE TYPE "ReviewCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReviewRelation" AS ENUM ('SELF', 'MANAGER', 'PEER', 'SUBORDINATE');

-- CreateEnum
CREATE TYPE "ReviewSubjectStatus" AS ENUM ('OPEN', 'CLOSED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ReviewAssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED');

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "managerId" TEXT;

-- CreateTable
CREATE TABLE "ReviewCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "ReviewFrequency" NOT NULL DEFAULT 'ADHOC',
    "status" "ReviewCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "raterWeights" JSONB NOT NULL,
    "anonymityMinRaters" INTEGER NOT NULL DEFAULT 3,
    "includeSelf" BOOLEAN NOT NULL DEFAULT true,
    "shareWithEmployee" BOOLEAN,
    "questionSetId" TEXT NOT NULL,
    "questionSetSnapshot" JSONB,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSubject" (
    "id" TEXT NOT NULL,
    "status" "ReviewSubjectStatus" NOT NULL DEFAULT 'OPEN',
    "cycleId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" TEXT NOT NULL,
    "relation" "ReviewRelation" NOT NULL,
    "status" "ReviewAssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "subjectId" TEXT NOT NULL,
    "raterPersonnelId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "questionSetSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "scaleValue" INTEGER,
    "choiceKey" TEXT,
    "textAnswer" TEXT,
    "durationSec" INTEGER,
    "assignmentId" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewCycle_organizationId_status_idx" ON "ReviewCycle"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ReviewSubject_personnelId_idx" ON "ReviewSubject"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSubject_cycleId_personnelId_key" ON "ReviewSubject"("cycleId", "personnelId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_raterPersonnelId_status_idx" ON "ReviewAssignment"("raterPersonnelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAssignment_subjectId_raterPersonnelId_key" ON "ReviewAssignment"("subjectId", "raterPersonnelId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAnswer_assignmentId_questionId_key" ON "ReviewAnswer"("assignmentId", "questionId");

-- CreateIndex
CREATE INDEX "Personnel_managerId_idx" ON "Personnel"("managerId");

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "QuestionSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSubject" ADD CONSTRAINT "ReviewSubject_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSubject" ADD CONSTRAINT "ReviewSubject_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "ReviewSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_raterPersonnelId_fkey" FOREIGN KEY ("raterPersonnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnswer" ADD CONSTRAINT "ReviewAnswer_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

