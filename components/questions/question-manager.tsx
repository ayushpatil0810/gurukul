"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicQuestion } from "@/lib/engine/public-question";

type ConceptOption = { id: string; name: string };

export function QuestionManager({
  questions,
  concepts,
}: {
  questions: PublicQuestion[];
  concepts: ConceptOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [statement, setStatement] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? "");
  const [visibleInput, setVisibleInput] = useState("");
  const [visibleExpected, setVisibleExpected] = useState("");
  const [hiddenInput, setHiddenInput] = useState("");
  const [hiddenExpected, setHiddenExpected] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statement,
        difficulty,
        languages: ["javascript"],
        starterCode: { javascript: "" },
        conceptIds: [conceptId],
        status: "published",
        tests: [
          { visibility: "visible", input: visibleInput, expectedOutput: visibleExpected },
          { visibility: "hidden", input: hiddenInput, expectedOutput: hiddenExpected },
        ],
      }),
    });
    const payload = (await response.json()) as {
      success: boolean;
      error?: { message?: string };
      data?: PublicQuestion;
    };
    setPending(false);
    if (!response.ok || !payload.success) {
      setError(payload.error?.message ?? "Could not save the question");
      return;
    }
    const serialized = JSON.stringify(payload.data);
    if (serialized.includes(hiddenInput) || serialized.includes(hiddenExpected)) {
      setError("The server echoed a hidden test. The question was not shown.");
      return;
    }
    setStatement("");
    setHiddenInput("");
    setHiddenExpected("");
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions yet.</p>
        ) : (
          questions.map((question) => (
            <article key={question.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">{question.statement}</h2>
                <span className="text-xs text-muted-foreground">Difficulty {question.difficulty}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {question.visibleTestCount} visible {question.visibleTestCount === 1 ? "test" : "tests"}
                {" · "}
                {question.hiddenTestCount} hidden {question.hiddenTestCount === 1 ? "test" : "tests"} stored on the server
                {" · "}
                {question.status}
              </p>
            </article>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">New question</h2>
        <div className="space-y-1.5">
          <Label htmlFor="statement">Statement</Label>
          <textarea
            id="statement"
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="difficulty">Difficulty (1-5)</Label>
          <Input
            id="difficulty"
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(event) => setDifficulty(Number(event.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="concept">Concept</Label>
          <select
            id="concept"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={conceptId}
            onChange={(event) => setConceptId(event.target.value)}
          >
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visible-input">Visible test input</Label>
          <Input id="visible-input" value={visibleInput} onChange={(event) => setVisibleInput(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visible-output">Visible expected output</Label>
          <Input
            id="visible-output"
            value={visibleExpected}
            onChange={(event) => setVisibleExpected(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hidden-input">Hidden test input</Label>
          <Input id="hidden-input" value={hiddenInput} onChange={(event) => setHiddenInput(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hidden-output">Hidden expected output</Label>
          <Input
            id="hidden-output"
            value={hiddenExpected}
            onChange={(event) => setHiddenExpected(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending || concepts.length === 0}>
          Save question
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </div>
  );
}
