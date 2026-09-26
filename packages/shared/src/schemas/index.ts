import { z } from "zod";

// ─────────────────────────────────────────
// TEMEL ŞEMALAR
// ─────────────────────────────────────────

export const cuidSchema = z.string().cuid();
export const emailSchema = z.string().email("Geçerli bir e-posta adresi girin");
export const scoreSchema = z.number().min(0).max(10);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifre boş bırakılamaz"),
  rememberMe: z.boolean().default(false),
});

export const portalLoginSchema = z.object({
  employeeId: z.string().min(1, "Sicil numarası boş bırakılamaz"),
  password: z.string().min(1, "Şifre boş bırakılamaz"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .regex(/[A-Z]/, "En az bir büyük harf içermeli")
    .regex(/[0-9]/, "En az bir rakam içermeli"),
});

// ─────────────────────────────────────────
// PERSONEL
// ─────────────────────────────────────────

const personnelStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]);
const personnelShiftEnum = z.enum([
  "NONE",
  "MORNING",
  "AFTERNOON",
  "NIGHT",
  "ROTATING",
]);

/** Formlardaki boş metin alanlarını ("") `null` olarak normalize eder. */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    schema,
  );

/** `datetime-local` ("2026-01-05T09:30") dahil ayrıştırılabilir tarih metni */
const optionalDateString = emptyToNull(
  z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Geçerli bir tarih girin")
    .nullable()
    .optional(),
);

/** İlişki kimlikleri (seed verilerinde cuid dışı kimlikler de bulunur) */
const optionalId = emptyToNull(z.string().min(1).nullable().optional());

export const createPersonnelSchema = z.object({
  employeeId: z.string().trim().min(1, "Sicil numarası zorunlu").max(50),
  firstName: z.string().trim().min(1, "Ad zorunlu").max(100),
  lastName: z.string().trim().min(1, "Soyad zorunlu").max(100),
  email: emailSchema,
  phone: emptyToNull(z.string().max(30).nullable().optional()),
  position: z.string().trim().min(1, "Pozisyon zorunlu").max(200),
  experienceYear: z.preprocess(
    (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? 0 : v),
    z.number().int().min(0, "Deneyim negatif olamaz").default(0),
  ),
  status: personnelStatusEnum.default("ACTIVE"),
  departmentId: optionalId,
  teamId: optionalId,
  shift: personnelShiftEnum.default("NONE"),
  preferredLanguage: z.string().length(2).default("tr"),
  hireDate: optionalDateString,
  birthDate: optionalDateString,
  notes: emptyToNull(z.string().max(2000).nullable().optional()),
  /** Personel portalı giriş şifresi (boş bırakılırsa değiştirilmez) */
  portalPassword: emptyToNull(
    z
      .string()
      .min(6, "Portal şifresi en az 6 karakter olmalı")
      .max(128)
      .nullable()
      .optional(),
  ),
});

export const updatePersonnelSchema = createPersonnelSchema.partial();

export const personnelImportRowSchema = z.object({
  sicil_no: z.string().min(1),
  ad: z.string().min(1),
  soyad: z.string().min(1),
  email: emailSchema,
  telefon: z.string().optional(),
  pozisyon: z.string().min(1),
  departman: z.string().optional(),
  takim: z.string().optional(),
  ise_giris_tarihi: z.string().optional(),
  deneyim_yil: z.coerce.number().int().min(0).optional(),
  vardiya: z.string().optional(),
});

// ─────────────────────────────────────────
// SORU
// ─────────────────────────────────────────

const questionDimensionEnum = z.enum([
  "LOGICAL_ALGORITHMIC",
  "LEADERSHIP",
  "SOCIAL_INTELLIGENCE",
  "GROWTH_POTENTIAL",
  "DOMAIN_ALIGNMENT",
]);

const questionTypeEnum = z.enum([
  "OPEN_ENDED",
  "SITUATIONAL",
  "BEHAVIORAL",
  "SCALE",
  "MULTIPLE_CHOICE",
]);

const questionPhaseEnum = z.enum(["ICEBREAKER", "CORE", "CLOSING"]);

export const createQuestionSchema = z.object({
  text: z.string().min(5, "Soru metni en az 5 karakter olmalı"),
  subText: z.string().optional().nullable(),
  dimension: questionDimensionEnum,
  type: questionTypeEnum,
  phase: questionPhaseEnum,
  weight: z.number().min(0.1).max(10).default(1.0),
  followUpPrompt: z.string().optional().nullable(),
  options: z.record(z.string()).optional().nullable(),
  minScale: z.number().int().min(0).optional().nullable(),
  maxScale: z.number().int().max(100).optional().nullable(),
  tags: z.array(z.string()).default([]),
  language: z.string().length(2).default("tr"),
});

export const updateQuestionSchema = createQuestionSchema.partial();

// ─────────────────────────────────────────
// SORU SETİ
// ─────────────────────────────────────────

const questionSetFields = z.object({
  name: z.string().min(2, "Soru seti adı zorunlu"),
  description: z.string().optional().nullable(),
  weightLogical: z.number().min(0).max(100),
  weightLeadership: z.number().min(0).max(100),
  weightSocial: z.number().min(0).max(100),
  weightGrowth: z.number().min(0).max(100),
  weightDomain: z.number().min(0).max(100),
});

export const createQuestionSetSchema = questionSetFields.refine(
  (w) =>
    Math.abs(
      w.weightLogical +
        w.weightLeadership +
        w.weightSocial +
        w.weightGrowth +
        w.weightDomain -
        100
    ) < 0.01,
  { message: "Boyut ağırlıklarının toplamı 100 olmalı" }
);

/** PATCH: ağırlık toplamı doğrulaması API katmanında (kısmi güncellemede Zod refine güvenilir değil) */
export const updateQuestionSetSchema = questionSetFields.partial();

// ─────────────────────────────────────────
// DEĞERLENDİRME
// ─────────────────────────────────────────

export const createAssessmentSchema = z.object({
  title: z.string().min(2, "Başlık zorunlu"),
  description: z.string().optional().nullable(),
  questionSetId: z.string().cuid(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const assignAssessmentSchema = z.object({
  personnelIds: z.array(z.string().cuid()).min(1),
  dueAt: z.string().datetime().optional().nullable(),
});

// ─────────────────────────────────────────
// CEVAP (PORTAL)
// ─────────────────────────────────────────

export const submitAnswerSchema = z.object({
  questionId: z.string().cuid(),
  textAnswer: z.string().optional().nullable(),
  scaleValue: z.number().int().min(1).max(10).optional().nullable(),
  choiceKey: z.string().optional().nullable(),
  durationSec: z.number().int().min(0).optional(),
  clientDedupeKey: z.string().uuid().optional(),
  followUpAnswer: z.string().optional().nullable(),
});

// ─────────────────────────────────────────
// AI CONFIG
// ─────────────────────────────────────────

const aiProviderEnum = z.enum([
  "CLAUDE",
  "OPENAI",
  "GEMINI",
  "ABACUS",
  "MOCK",
]);

export const createAiConfigSchema = z.object({
  provider: aiProviderEnum,
  modelName: z.string().min(1),
  apiKey: z.string().min(1),
  isDefault: z.boolean().default(false),
  purpose: z.string().min(1),
  config: z.record(z.unknown()).optional().nullable(),
});

// ─────────────────────────────────────────
// AI SORU ÜRETİMİ
// ─────────────────────────────────────────

export const generateQuestionsSchema = z.object({
  provider: aiProviderEnum,
  totalCount: z.number().int().min(5).max(30).default(15),
  dimensionWeights: z.object({
    LOGICAL_ALGORITHMIC: z.number().min(0).max(100),
    LEADERSHIP: z.number().min(0).max(100),
    SOCIAL_INTELLIGENCE: z.number().min(0).max(100),
    GROWTH_POTENTIAL: z.number().min(0).max(100),
    DOMAIN_ALIGNMENT: z.number().min(0).max(100),
  }),
  questionTypes: z.array(questionTypeEnum).min(1),
  icebreakerCount: z.number().int().min(0).max(5).default(2),
  closingCount: z.number().int().min(0).max(5).default(2),
  targetRole: z.string().default("CNC Operatörü"),
  experienceLevel: z.string().default("0-5 yıl"),
  customNote: z.string().optional(),
});

// ─────────────────────────────────────────
// RIZA (KVKK)
// ─────────────────────────────────────────

export const acceptConsentSchema = z.object({
  consentType: z.enum(["DATA_PROCESSING", "AI_ASSESSMENT", "PORTAL_TERMS"]),
  legalTextVersion: z.string(),
  sessionId: z.string().cuid().optional(),
});

// ─────────────────────────────────────────
// KULLANICI
// ─────────────────────────────────────────

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
  role: z.enum(["ADMIN", "HR_MANAGER", "ANALYST", "VIEWER"]),
  scopedDepartmentId: z.string().cuid().optional().nullable(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "HR_MANAGER", "ANALYST", "VIEWER"]),
  scopedDepartmentId: z.string().cuid().optional().nullable(),
});

// ─────────────────────────────────────────
// EXPORT (Type inference helpers)
// ─────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type PortalLoginInput = z.infer<typeof portalLoginSchema>;
export type CreatePersonnelInput = z.infer<typeof createPersonnelSchema>;
export type UpdatePersonnelInput = z.infer<typeof updatePersonnelSchema>;
export type PersonnelImportRow = z.infer<typeof personnelImportRowSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type CreateQuestionSetInput = z.infer<typeof createQuestionSetSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
export type AcceptConsentInput = z.infer<typeof acceptConsentSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
