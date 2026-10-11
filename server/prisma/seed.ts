// server/.env (ve kök .env) yüklensin: `npm run db:seed` tsx ile doğrudan çalışır
import "../src/env.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedRespondents } from "./seed-respondents.js";

const prisma = new PrismaClient();

function teamSeedId(name: string) {
  return `seed-team-${name.toLowerCase().replace(/\s+/g, "-")}`;
}

async function main() {
  console.log("🌱 Seed başlıyor...");

  // ── Organization ──────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    create: {
      name: "Demo Şirket A.Ş.",
      slug: "default",
      timezone: "Europe/Istanbul",
    },
    update: {},
  });
  console.log(`✅ Organization: ${org.name}`);

  // ── Super Admin ───────────────────────────────
  const adminPassword = await bcrypt.hash("Admin1234!", 12);
  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "admin@example.com" } },
    create: {
      email: "admin@example.com",
      password: adminPassword,
      name: "Süper Admin",
      role: "SUPER_ADMIN",
      organizationId: org.id,
    },
    update: {},
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ── HR Manager ────────────────────────────────
  const hrPassword = await bcrypt.hash("Hr1234567!", 12);
  const hrManager = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "hr@example.com" } },
    create: {
      email: "hr@example.com",
      password: hrPassword,
      name: "İK Yöneticisi",
      role: "HR_MANAGER",
      organizationId: org.id,
    },
    update: {},
  });
  console.log(`✅ HR Manager: ${hrManager.email}`);

  // ── Departments ───────────────────────────────
  const deptNames = [
    { name: "Üretim", color: "#2BB87E" },
    { name: "Kalite", color: "#3B82F6" },
    { name: "Bakım", color: "#F59E0B" },
  ];

  const departments: Record<string, string> = {};
  for (const d of deptNames) {
    const dept = await prisma.department.upsert({
      where: { organizationId_name: { organizationId: org.id, name: d.name } },
      create: { name: d.name, color: d.color, organizationId: org.id },
      update: {},
    });
    departments[d.name] = dept.id;
    console.log(`✅ Department: ${dept.name}`);
  }

  // ── Teams ─────────────────────────────────────
  const teams: Record<string, string> = {};
  const teamDefs = [
    { name: "CNC Ekibi A", dept: "Üretim" },
    { name: "CNC Ekibi B", dept: "Üretim" },
    { name: "Kalite Kontrol", dept: "Kalite" },
    { name: "Ölçüm Ekibi", dept: "Kalite" },
    { name: "Elektrik Bakım", dept: "Bakım" },
    { name: "Mekanik Bakım", dept: "Bakım" },
  ];

  for (const t of teamDefs) {
    const tid = teamSeedId(t.name);
    const team = await prisma.team.upsert({
      where: { id: tid },
      create: {
        id: tid,
        name: t.name,
        departmentId: departments[t.dept]!,
        organizationId: org.id,
      },
      update: {},
    });
    teams[t.name] = team.id;
    console.log(`✅ Team: ${team.name}`);
  }

  // ── Demo Personnel ────────────────────────────
  const portalPassword = await bcrypt.hash("Portal123!", 12);
  const personnelData = [
    { employeeId: "P001", firstName: "Ahmet", lastName: "Yılmaz", position: "CNC Operatörü", dept: "Üretim", team: "CNC Ekibi A" },
    { employeeId: "P002", firstName: "Mehmet", lastName: "Demir", position: "Tezgah Operatörü", dept: "Üretim", team: "CNC Ekibi B" },
    { employeeId: "P003", firstName: "Fatma", lastName: "Kaya", position: "Kalite Kontrol", dept: "Kalite", team: "Kalite Kontrol" },
    { employeeId: "P004", firstName: "Ali", lastName: "Çelik", position: "Bakım Teknisyeni", dept: "Bakım", team: "Mekanik Bakım" },
    { employeeId: "P005", firstName: "Ayşe", lastName: "Şahin", position: "CNC Operatörü", dept: "Üretim", team: "CNC Ekibi A" },
  ];

  for (const p of personnelData) {
    const existing = await prisma.personnel.findFirst({
      where: { employeeId: p.employeeId, organizationId: org.id },
    });
    if (!existing) {
      await prisma.personnel.create({
        data: {
          employeeId: p.employeeId,
          firstName: p.firstName,
          lastName: p.lastName,
          email: `${p.employeeId.toLowerCase()}@demo.com`,
          position: p.position,
          departmentId: departments[p.dept]!,
          teamId: teams[p.team]!,
          organizationId: org.id,
          portalPasswordHash: portalPassword,
          shift: "MORNING",
          experienceYear: Math.floor(Math.random() * 8) + 1,
        },
      });
      console.log(`✅ Personnel: ${p.firstName} ${p.lastName}`);
    }
  }

  // ── Default Question Set ──────────────────────
  const existingSet = await prisma.questionSet.findFirst({
    where: { isDefault: true, organizationId: org.id },
  });

  if (!existingSet) {
    const qSet = await prisma.questionSet.create({
      data: {
        name: "Standart CNC Değerlendirme v1",
        description: "CNC operatörleri için 5 boyutlu temel değerlendirme seti",
        isDefault: true,
        version: 1,
        createdById: admin.id,
        organizationId: org.id,
        weightLogical: 25,
        weightLeadership: 20,
        weightSocial: 20,
        weightGrowth: 20,
        weightDomain: 15,
      },
    });

    // 30 demo soru
    const questionDefs = [
      // LOGICAL_ALGORITHMIC (6)
      { text: "Bir CNC programında beklenmedik bir hatayla karşılaştığınızda, problemi nasıl adım adım çözersiniz?", dimension: "LOGICAL_ALGORITHMIC", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Üretimde aynı parça ölçüsünün sürekli sapma gösterdiğini fark ettiniz. Bu problemi bulmak için nasıl bir yol izlersiniz?", dimension: "LOGICAL_ALGORITHMIC", type: "SITUATIONAL", phase: "CORE" },
      { text: "Üretim sürecinizi daha verimli hale getirmek için ne tür değişiklikler düşünürdünüz?", dimension: "LOGICAL_ALGORITHMIC", type: "BEHAVIORAL", phase: "CORE" },
      { text: "Karmaşık bir talimata ilk baktığınızda ne yaparsınız?", dimension: "LOGICAL_ALGORITHMIC", type: "OPEN_ENDED", phase: "ICEBREAKER" },
      { text: "Günlük işinizdeki adımları nasıl organize edersiniz?", dimension: "LOGICAL_ALGORITHMIC", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Şu ana kadar çözdüğünüz en zorlu teknik problem neydi?", dimension: "LOGICAL_ALGORITHMIC", type: "BEHAVIORAL", phase: "CORE" },
      // LEADERSHIP (6)
      { text: "Ekibinizde bir anlaşmazlık çıktığında nasıl bir rol üstlenirsiniz?", dimension: "LEADERSHIP", type: "SITUATIONAL", phase: "CORE" },
      { text: "Yeni başlayan bir iş arkadaşına bir şey öğretmeniz gerekse nasıl anlatırdınız?", dimension: "LEADERSHIP", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Bir kez kendi inisiyatifinizle bir sorunu çözdüğünüz zamanı anlatır mısınız?", dimension: "LEADERSHIP", type: "BEHAVIORAL", phase: "CORE" },
      { text: "Vardiya amiri olmak ister misiniz? Neden?", dimension: "LEADERSHIP", type: "OPEN_ENDED", phase: "CLOSING" },
      { text: "Ekipteki düşük performanslı birine nasıl yaklaşırdınız?", dimension: "LEADERSHIP", type: "SITUATIONAL", phase: "CORE" },
      { text: "Sizi en çok ne motive eder?", dimension: "LEADERSHIP", type: "OPEN_ENDED", phase: "ICEBREAKER" },
      // SOCIAL_INTELLIGENCE (6)
      { text: "İş yerinde zor bir müşteriyle veya iş arkadaşıyla nasıl başa çıktınız?", dimension: "SOCIAL_INTELLIGENCE", type: "BEHAVIORAL", phase: "CORE" },
      { text: "Farklı çalışma tarzına sahip biriyle nasıl iş birliği yaparsınız?", dimension: "SOCIAL_INTELLIGENCE", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Haksız eleştirildiğinizde nasıl tepki verirsiniz?", dimension: "SOCIAL_INTELLIGENCE", type: "SITUATIONAL", phase: "CORE" },
      { text: "Günlük iş hayatınızda güveni nasıl inşa edersiniz?", dimension: "SOCIAL_INTELLIGENCE", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Bir meslektaşınızın zor bir günde olduğunu fark ettiniz; ne yaparsınız?", dimension: "SOCIAL_INTELLIGENCE", type: "SITUATIONAL", phase: "CORE" },
      { text: "İletişim kurma şeklinizi nasıl tanımlarsınız?", dimension: "SOCIAL_INTELLIGENCE", type: "OPEN_ENDED", phase: "ICEBREAKER" },
      // GROWTH_POTENTIAL (6)
      { text: "Son 1 yılda kendinize kattığınız en önemli beceri ya da bilgi nedir?", dimension: "GROWTH_POTENTIAL", type: "BEHAVIORAL", phase: "CORE" },
      { text: "Hata yaptığınızda nasıl tepki verirsiniz?", dimension: "GROWTH_POTENTIAL", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Fabrikada bir teknolojiyi/makineyi hiç öğrenmeden önce nasıl öğrendiniz?", dimension: "GROWTH_POTENTIAL", type: "BEHAVIORAL", phase: "CORE" },
      { text: "5 yıl sonra nerede olmak istersiniz?", dimension: "GROWTH_POTENTIAL", type: "OPEN_ENDED", phase: "CLOSING" },
      { text: "Kendinizi geliştirmek için ne gibi şeyler yapıyorsunuz?", dimension: "GROWTH_POTENTIAL", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Zorlu bir dönemden nasıl çıktınız?", dimension: "GROWTH_POTENTIAL", type: "BEHAVIORAL", phase: "CORE" },
      // DOMAIN_ALIGNMENT (6)
      { text: "Fabrika ortamının hangi yönü size en uygun geliyor?", dimension: "DOMAIN_ALIGNMENT", type: "OPEN_ENDED", phase: "CORE" },
      { text: "CNC programlama konusunu kendinizi nasıl değerlendirirsiniz? (1-10)", dimension: "DOMAIN_ALIGNMENT", type: "SCALE", phase: "CORE" },
      { text: "Hangi tür görevlerde en verimli çalıştığınızı düşünüyorsunuz?", dimension: "DOMAIN_ALIGNMENT", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Üretim kalitesi mi hız mı sizin için daha önemli? Neden?", dimension: "DOMAIN_ALIGNMENT", type: "OPEN_ENDED", phase: "CORE" },
      { text: "Hangi alanda daha fazla sorumluluk almak istersiniz?", dimension: "DOMAIN_ALIGNMENT", type: "OPEN_ENDED", phase: "CLOSING" },
      { text: "İşinizin en çok hangi kısmından keyif alırsınız?", dimension: "DOMAIN_ALIGNMENT", type: "OPEN_ENDED", phase: "ICEBREAKER" },
    ] as const;

    for (let i = 0; i < questionDefs.length; i++) {
      const q = questionDefs[i]!;
      const question = await prisma.question.create({
        data: {
          text: q.text,
          dimension: q.dimension as "LOGICAL_ALGORITHMIC",
          type: q.type as "OPEN_ENDED",
          phase: q.phase as "ICEBREAKER",
          weight: 1.0,
          minScale: q.type === "SCALE" ? 1 : null,
          maxScale: q.type === "SCALE" ? 10 : null,
          tags: ["cnc", "uretim"],
          language: "tr",
          organizationId: org.id,
        },
      });

      await prisma.questionSetItem.create({
        data: {
          questionSetId: qSet.id,
          questionId: question.id,
          order: i + 1,
          isRequired: true,
        },
      });
    }

    console.log(`✅ QuestionSet: ${qSet.name} (${questionDefs.length} soru)`);
  }

  // ── Örnek değerlendirme, oturumlar, bildirimler ──
  const questionSet = await prisma.questionSet.findFirst({
    where: { organizationId: org.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (questionSet) {
    const ASSESSMENT_ID = "seed-assessment-demo-001";
    const now = new Date();
    await prisma.assessment.upsert({
      where: { id: ASSESSMENT_ID },
      create: {
        id: ASSESSMENT_ID,
        title: "2026 Q1 Potansiyel Haritası",
        description:
          "Örnek aktif değerlendirme — pano, analitik ve portal akışını test etmek için.",
        status: "ACTIVE",
        questionSetId: questionSet.id,
        createdById: admin.id,
        organizationId: org.id,
        startsAt: new Date(now.getFullYear(), now.getMonth(), 1),
        endsAt: new Date(now.getFullYear(), 11, 31),
      },
      update: {
        status: "ACTIVE",
        questionSetId: questionSet.id,
      },
    });
    console.log(`✅ Assessment (örnek): ${ASSESSMENT_ID}`);

    const personnelRows = await prisma.personnel.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
      },
    });
    const byEmp = Object.fromEntries(personnelRows.map((p) => [p.employeeId, p]));

    // P001–P003: atanmış, henüz başlamamış oturumlar
    for (const empId of ["P001", "P002", "P003"]) {
      const p = byEmp[empId];
      if (!p) continue;
      await prisma.assessmentSession.upsert({
        where: { assessmentId_personnelId: { assessmentId: ASSESSMENT_ID, personnelId: p.id } },
        create: {
          assessmentId: ASSESSMENT_ID,
          personnelId: p.id,
          status: "NOT_STARTED",
          analysisPipeline: "NOT_QUEUED",
          requiresHrReview: true,
        },
        update: {},
      });
    }
    console.log("✅ Oturum (bekleyen): P001–P003 → NOT_STARTED");

    // P006–P008: soruların tamamını cevaplamış örnek personel. AI analizi ve AI
    // yapılandırması seed edilmez; entegrasyon bağlanana kadar panel "bağlı değil" der.
    await seedRespondents({
      prisma,
      organizationId: org.id,
      assessmentId: ASSESSMENT_ID,
      questionSetId: questionSet.id,
      departments,
      teams,
      portalPasswordHash: portalPassword,
      now,
    });

    await prisma.notification.upsert({
      where: { id: "seed-notification-admin-1" },
      create: {
        id: "seed-notification-admin-1",
        userId: admin.id,
        type: "INFO",
        title: "Örnek bildirim",
        body: "Seed: P006–P008 değerlendirmeyi tamamladı. AI analizi için önce AI entegrasyonunu bağlayın.",
      },
      update: {},
    });
    await prisma.notification.upsert({
      where: { id: "seed-notification-hr-1" },
      create: {
        id: "seed-notification-hr-1",
        userId: hrManager.id,
        type: "ASSESSMENT",
        title: "Yeni değerlendirme özeti",
        body: "2026 Q1 Potansiyel Haritası aktif; P001–P003 için bekleyen oturum var.",
      },
      update: {},
    });
    console.log("✅ Bildirimler (admin + İK)");
  }

  console.log("\n🎉 Seed tamamlandı!");
  console.log("─────────────────────────────────────────");
  console.log("Admin:    admin@example.com / Admin1234!");
  console.log("HR Mgr:   hr@example.com   / Hr1234567!");
  console.log("Portal:   P001–P008        / Portal123!");
  console.log("─────────────────────────────────────────");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
