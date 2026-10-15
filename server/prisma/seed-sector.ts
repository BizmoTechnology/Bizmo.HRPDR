// Mevcut bir veritabanına yalnız sektörel soru şablonlarını ekler (sıfırlama/yeniden seed yok):
//   npm run db:seed:sector
import "../src/env.js";
import { PrismaClient } from "@prisma/client";
import { seedSectorTemplates } from "./seed-sector-templates.js";

const prisma = new PrismaClient();

async function main() {
  const slug = process.env["SEED_ORG_SLUG"] ?? "default";
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) throw new Error(`Organizasyon bulunamadı: ${slug}`);

  // Şablon setlerinin "oluşturan" kullanıcısı: organizasyonun ilk yöneticisi
  const creator = await prisma.user.findFirst({
    where: { organizationId: org.id, deletedAt: null, role: { in: ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!creator) throw new Error(`${org.name} için yönetici kullanıcı bulunamadı`);

  const { created, skipped } = await seedSectorTemplates({
    prisma,
    organizationId: org.id,
    createdById: creator.id,
  });

  for (const name of created) console.log(`✅ Soru seti eklendi: ${name}`);
  for (const name of skipped) console.log(`↷ Zaten var, dokunulmadı: ${name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
