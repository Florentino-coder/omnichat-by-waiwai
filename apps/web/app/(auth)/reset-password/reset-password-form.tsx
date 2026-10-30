"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Input, Label } from "@omnichat/ui";
import { resetPasswordSchema } from "../../../lib/schemas/auth";
import type { z } from "zod";

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const labelClassName = "text-sm font-medium text-slate-200";
const fieldGroupClassName = "space-y-4";
const fieldClassName = "space-y-2";
const linkClassName = "inline-block text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300";

export function ResetPasswordForm({ token }: { token: string }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: ""
    }
  });

  if (!token) {
    return (
      <div className="space-y-4">
        <p
          className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-sm text-red-200"
          role="alert"
        >
          This reset link is missing its token. Request a new link.
        </p>
        <Link className={linkClassName} href="/forgot-password">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordValues): Promise<void> {
    setSubmitError(null);
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        body: JSON.stringify({ token, newPassword: values.newPassword }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
          message?: string;
        } | null;
        setSubmitError(body?.error?.message ?? body?.message ?? "Could not reset password.");
        return;
      }

      setSuccess(true);
    } catch {
      setSubmitError("Could not reset password right now. Try again.");
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <p
          className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2.5 text-sm text-emerald-200"
          role="status"
        >
          Password updated. You can sign in with your new password.
        </p>
        <Link className={linkClassName} href="/login">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={fieldGroupClassName}>
        <div className={fieldClassName}>
          <Label htmlFor="new-password" className={labelClassName}>
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register("newPassword")}
          />
          {errors.newPassword ? (
            <p className="text-xs text-red-300" role="alert">
              {errors.newPassword.message}
            </p>
          ) : null}
        </div>
        <div className={fieldClassName}>
          <Label htmlFor="confirm-password" className={labelClassName}>
            Confirm password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-red-300" role="alert">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <div className="space-y-2">
          <p
            className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-sm text-red-200"
            role="alert"
          >
            {submitError}
          </p>
          <Link className={linkClassName} href="/forgot-password">
            Request a new link
          </Link>
        </div>
      ) : null}

      <Button
        className="w-full bg-indigo-600 font-medium text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
