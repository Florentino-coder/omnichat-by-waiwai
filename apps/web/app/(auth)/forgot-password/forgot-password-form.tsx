"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Input, Label } from "@omnichat/ui";
import { forgotPasswordSchema } from "../../../lib/schemas/auth";
import type { z } from "zod";

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const labelClassName = "text-sm font-medium text-slate-200";
const fieldClassName = "space-y-2";

export function ForgotPasswordForm() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: ""
    }
  });

  async function onSubmit(values: ForgotPasswordValues): Promise<void> {
    setSubmitError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        body: JSON.stringify({ identifier: values.identifier.trim() }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
          message?: string;
        } | null;
        setSubmitError(body?.error?.message ?? body?.message ?? "Could not send reset link.");
        return;
      }

      setSuccess(true);
    } catch {
      setSubmitError("Could not send reset link right now. Try again.");
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <p
          className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2.5 text-sm text-emerald-200"
          role="status"
        >
          If an account matches, we sent a reset link to its registered email. The link expires in 30
          minutes.
        </p>
        <Link
          className="inline-block text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={fieldClassName}>
        <Label htmlFor="identifier" className={labelClassName}>
          Email or username
        </Label>
        <Input
          id="identifier"
          autoComplete="username"
          placeholder="e.g. owner or owner@omnichat.local"
          {...register("identifier")}
        />
        {errors.identifier ? (
          <p className="text-xs text-red-300" role="alert">
            {errors.identifier.message}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-sm text-red-200"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <div className="space-y-3 pt-1">
        <Button
          className="w-full bg-indigo-600 font-medium text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
        <Link
          className="block text-center text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
