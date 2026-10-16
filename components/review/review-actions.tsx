"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { disposition: "dismissed", label: "Dismiss", note: "optional" },
  { disposition: "needs_viva", label: "Needs viva", note: "optional" },
  { disposition: "escalated", label: "Escalate", note: "required" },
] as const;

export function ReviewActions({ signalId }: { signalId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function submit(disposition: (typeof ACTIONS)[number]["disposition"]) {
    setError(null);
    setPending(disposition);
    try {
      const response = await fetch(`/api/signals/${signalId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disposition, note }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(body.error?.message ?? "The review could not be saved");
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("The review could not be saved");
    } finally {
      setPending(null);
    }
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-border p-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="block text-sm" htmlFor="review-note">
        Note
        <textarea
          id="review-note"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Dismiss and needs viva can be saved without a note. Escalate needs a written note. The reviewer and time are
        taken from the signed-in account.
      </p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Button
            key={action.disposition}
            type="button"
            variant={action.disposition === "escalated" ? "default" : "outline"}
            disabled={pending !== null}
            onClick={() => submit(action.disposition)}
          >
            {pending === action.disposition ? "Saving…" : action.label}
            <span className="sr-only">, note {action.note}</span>
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
