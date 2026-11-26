-- Soruya deterministik puanlama kuralı: ters puanlanan Likert maddeleri ve
-- puan anahtarlı çoktan seçmeli (durumsal yargı / bilgi) sorular.
-- Yalnız sütun eklenir; mevcut sorular (NULL) eskisi gibi puanlanır.
ALTER TABLE "Question" ADD COLUMN "scoring" JSONB;
