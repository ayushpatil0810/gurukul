import { Suspense } from "react";
import { type Metadata } from "next";
import { LoginTabs } from "./login-tabs";

export const metadata: Metadata = {
  title: "Authentication | Hackathon Starter",
  description: "Sign in or create an account with email and password",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
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
