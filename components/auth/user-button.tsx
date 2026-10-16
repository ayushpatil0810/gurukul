"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function UserButton() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  if (isPending) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
    );
  }

  if (!session?.user) {
    return null;
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-xs">
          {initials}
        </div>
        <div className="hidden text-left text-xs md:block">
          <p className="font-medium leading-none text-foreground">
            {session.user.name}
          </p>
          <p className="text-muted-foreground">{session.user.email}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? "Signing out..." : "Sign Out"}
      </Button>
    </div>
  );
}
