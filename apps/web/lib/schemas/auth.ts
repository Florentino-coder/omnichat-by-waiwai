import { z } from "zod";

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);

export const loginSchema = z.object({
  email: z.string().min(1, "Email or Username is required"),
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
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  displayName: z.string().min(1),
  password: passwordSchema
});
