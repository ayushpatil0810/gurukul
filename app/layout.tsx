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
  title: "Adaptive Learning Portal",
  description:
    "Concept maps, question banks, and role-based access for TechSummitTrainers.",
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
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
          <p>
            TechSummitTrainers &bull; Adaptive Learning and Assessment Portal
          </p>
        </footer>
      </body>
    </html>
  );
}
