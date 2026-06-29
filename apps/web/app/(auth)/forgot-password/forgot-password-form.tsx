"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Input, Label } from "@omnichat/ui";
import { forgotPasswordSchema } from "../../../lib/schemas/auth";
import type { z } from "zod";

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

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
      identifier: "",
      email: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  async function onSubmit(values: ForgotPasswordValues): Promise<void> {
    setSubmitError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        body: JSON.stringify({
          identifier: values.identifier.trim(),
          email: values.email.trim(),
          newPassword: values.newPassword
        }),
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
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          Password updated. You can sign in with your new password.
        </p>
        <Link className="text-sm font-medium text-primary" href="/login">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or username</Label>
        <Input id="identifier" autoComplete="username" {...register("identifier")} />
        {errors.identifier ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.identifier.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="registered-email">Registered email</Label>
        <Input id="registered-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" {...register("newPassword")} />
        {errors.newPassword ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.newPassword.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
      {submitError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {submitError}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Reset password"}
      </Button>
      <Link className="block text-sm font-medium text-primary" href="/login">
        Back to sign in
      </Link>
    </form>
  );
}
