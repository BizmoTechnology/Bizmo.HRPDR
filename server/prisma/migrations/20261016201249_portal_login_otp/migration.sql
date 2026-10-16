-- SMS ile portal girişi: personele gönderilen tek kullanımlık kodlar (özetlenmiş).
-- Yalnız yeni tablo eklenir; mevcut veriler etkilenmez.

-- CreateTable
CREATE TABLE "PortalLoginOtp" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "providerOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personnelId" TEXT NOT NULL,

    CONSTRAINT "PortalLoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalLoginOtp_personnelId_createdAt_idx" ON "PortalLoginOtp"("personnelId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalLoginOtp_phone_createdAt_idx" ON "PortalLoginOtp"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "PortalLoginOtp_expiresAt_idx" ON "PortalLoginOtp"("expiresAt");

-- AddForeignKey
ALTER TABLE "PortalLoginOtp" ADD CONSTRAINT "PortalLoginOtp_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
