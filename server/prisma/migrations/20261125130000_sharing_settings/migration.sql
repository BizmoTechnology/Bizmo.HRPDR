-- Personelle sonuç paylaşımı: kurum ayarları + değerlendirme bazlı geçersiz kılma
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "settings" JSONB;

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "shareWithEmployee" BOOLEAN;
