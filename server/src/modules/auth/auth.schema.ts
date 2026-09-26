import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const portalLoginBodySchema = z.object({
  employeeId: z.string().min(1),
  password: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().optional(),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .regex(/[A-Z]/, "En az bir büyük harf içermeli")
    .regex(/[0-9]/, "En az bir rakam içermeli"),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type PortalLoginBody = z.infer<typeof portalLoginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
