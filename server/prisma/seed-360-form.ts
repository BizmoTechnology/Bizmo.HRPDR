// Mevcut bir veritabanına yalnız örnek 360° formunu ekler (örnek dönem, sıfırlama ya da yeniden seed yok):
//   npm run prisma:seed:360-form -w server
import "../src/env.js";
import { PrismaClient } from "@prisma/client";
import { seed360Form } from "./seed-reviews.js";

const prisma = new PrismaClient();

async function main() {
  const slug = process.env["SEED_ORG_SLUG"] ?? "default";
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) throw new Error(`Organizasyon bulunamadı: ${slug}`);

  // Setin "oluşturan" kullanıcısı: organizasyonun ilk yöneticisi
  const creator = await prisma.user.findFirst({
    where: { organizationId: org.id, deletedAt: null, role: { in: ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!creator) throw new Error(`${org.name} için yönetici kullanıcı bulunamadı`);

  const { created } = await seed360Form({ prisma, organizationId: org.id, createdById: creator.id });
  if (!created) console.log("↷ 360° formu zaten vardı, dokunulmadı");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
