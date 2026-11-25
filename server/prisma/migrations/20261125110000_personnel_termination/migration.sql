-- İşten ayrılan personel: yeni durum değeri ve ayrılış bilgileri.
-- Kayıt silinmez (deletedAt dokunulmaz); geçmiş ve analizler korunur, portal erişimi kapanır.

-- AlterEnum
ALTER TYPE "PersonnelStatus" ADD VALUE 'TERMINATED';

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "terminationDate" TIMESTAMP(3),
ADD COLUMN     "terminationNote" TEXT,
ADD COLUMN     "terminationReason" TEXT;
