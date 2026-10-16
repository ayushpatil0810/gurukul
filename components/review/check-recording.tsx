"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CheckRecording({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function check() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/signals`, { method: "POST" });
      const body = (await response.json()) as { error?: { message?: string }; data?: { signals?: unknown[] } };
      if (!response.ok) {
        setMessage(body.error?.message ?? "The recording could not be checked");
        return;
      }
      const count = body.data?.signals?.length ?? 0;
      setMessage(count === 0 ? "No review signals were stored." : `${count} review signal${count === 1 ? "" : "s"} stored.`);
      router.refresh();
    } catch {
      setMessage("The recording could not be checked");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={pending} onClick={check}>
        {pending ? "Checking…" : "Check recording"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
