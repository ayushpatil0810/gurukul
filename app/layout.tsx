import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { cn } from "cn";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LearnLoop — Adaptive Learning & Assessment",
    template: "%s · LearnLoop",
  },
  description:
    "Engineering-grade adaptive learning and assessment portal with concept prerequisite graphs, visual classroom lessons, DevOps simulations, and Bayesian Knowledge Tracing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        inter.variable,
        "font-sans"
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <Suspense fallback={<div className="h-16 border-b border-border/40" />}>
          <Navbar />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border/40 bg-card/40 py-6 text-center text-xs text-muted-foreground backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
            <p className="flex items-center gap-1.5 font-medium text-foreground/80">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              LearnLoop &bull; TechSummitTrainers
            </p>
            <p className="text-[11px] text-muted-foreground">
              Adaptive Learning &bull; Bayesian Knowledge Tracing &bull; Interactive DevOps Classroom
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
