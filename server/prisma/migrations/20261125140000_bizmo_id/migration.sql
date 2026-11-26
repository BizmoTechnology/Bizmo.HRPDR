-- Bizmo.ID (OIDC tek giriş, webhook, back-channel logout, SCIM)

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "externalDisabledAt" TIMESTAMP(3),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalProvider" TEXT;

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "external_provider" TEXT;

-- CreateTable
CREATE TABLE "SsoLoginFlow" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "bindingHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "handoffHash" TEXT,
    "subjectId" TEXT,
    "idToken" TEXT,
    "authMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoLoginFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BizmoIdIdentity" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "email" TEXT,
    "givenName" TEXT,
    "familyName" TEXT,
    "displayName" TEXT,
    "employeeNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "resource" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BizmoIdIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalProvider_externalId_key" ON "User"("externalProvider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_external_provider_external_id_key" ON "Personnel"("external_provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoLoginFlow_stateHash_key" ON "SsoLoginFlow"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "SsoLoginFlow_handoffHash_key" ON "SsoLoginFlow"("handoffHash");

-- CreateIndex
CREATE INDEX "SsoLoginFlow_expiresAt_idx" ON "SsoLoginFlow"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BizmoIdIdentity_externalId_key" ON "BizmoIdIdentity"("externalId");

-- CreateIndex
CREATE INDEX "BizmoIdIdentity_userName_idx" ON "BizmoIdIdentity"("userName");

-- CreateIndex
CREATE INDEX "BizmoIdIdentity_email_idx" ON "BizmoIdIdentity"("email");
