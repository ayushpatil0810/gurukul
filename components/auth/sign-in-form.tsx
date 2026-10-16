"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { signInSchema } from "@/lib/validations/auth";
import { validateInput } from "@/lib/validations/validate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignInFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export function SignInForm({ redirectTo = "/" }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const validation = validateInput(signInSchema, { email, password });
    if (!validation.success) {
      setFieldErrors(validation.error);
      return;
    }

    setIsLoading(true);

    try {
      const response = await signIn.email({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (response.error) {
        setGeneralError(response.error.message || "Failed to sign in. Please verify your credentials.");
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setGeneralError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {generalError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive/30">
          {generalError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email Address</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="developer@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
        />
        {fieldErrors.email && (
          <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
        </div>
        <Input
          id="signin-password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
        />
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In with Email"}
      </Button>
    </form>
  );
}
