import { Suspense } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginTabs } from "./login-tabs";

export const metadata: Metadata = {
  title: "Sign in | LearnLoop Adaptive Portal",
  description: "Sign in with your email and password to access the portal",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md space-y-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to LearnLoop Overview</span>
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="h-96 w-full animate-pulse rounded-2xl bg-card border border-border" />
          }
        >
          <LoginTabs />
        </Suspense>
      </div>
    </div>
  );
}
