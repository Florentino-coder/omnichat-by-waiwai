import { z } from "zod";

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  totpCode: z.string().length(6).optional()
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema
});

export const invitationAcceptSchema = z.object({
  token: z.string().min(1),
  displayName: z.string().min(1),
  password: passwordSchema
});
