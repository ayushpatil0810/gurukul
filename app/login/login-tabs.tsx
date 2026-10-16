"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { cn } from "cn";

export function LoginTabs() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [activeTab, setActiveTab] = React.useState<"signin" | "signup">(initialMode);

  return (
    <Card className="border-border/80 shadow-lg backdrop-blur-xs">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          🔒
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          {activeTab === "signin" ? "Welcome back" : "Create an account"}
        </CardTitle>
        <CardDescription>
          {activeTab === "signin"
            ? "Enter your credentials to access your session"
            : "Sign up with your email to start building"}
        </CardDescription>

        {/* Tab Switcher */}
        <div className="pt-4">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("signin")}
              className={cn(
                "rounded-md py-1.5 transition-all",
                activeTab === "signin"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className={cn(
                "rounded-md py-1.5 transition-all",
                activeTab === "signup"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {activeTab === "signin" ? (
          <SignInForm />
        ) : (
          <SignUpForm />
        )}
      </CardContent>
    </Card>
  );
}
