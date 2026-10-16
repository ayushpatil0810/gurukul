"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ModuleOption = { id: string; name: string; conceptIds: string[] };
type ConceptOption = { id: string; name: string };

export function NewLessonForm({ modules, concepts }: { modules: ModuleOption[]; concepts: ConceptOption[] }) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [conceptId, setConceptId] = useState("");
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [learnerLevel, setLearnerLevel] = useState("beginner");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("typescript");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const conceptChoices = useMemo(() => {
    const selectedModule = modules.find((item) => item.id === moduleId);
    const allowed = new Set(selectedModule?.conceptIds ?? []);
    return concepts.filter((concept) => allowed.has(concept.id));
  }, [concepts, moduleId, modules]);
  const selectedConcept = conceptChoices.some((concept) => concept.id === conceptId) ? conceptId : (conceptChoices[0]?.id ?? "");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleId,
          conceptId: selectedConcept,
          topic,
          objectives,
          learnerLevel,
          durationMinutes: Number(durationMinutes),
          sourceMaterial,
          codeLanguage,
        }),
      });
      const body = (await response.json()) as { success?: boolean; data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "The outline was not created.");
        return;
      }
      router.push(`/studio/${body.data.id}`);
    } catch {
      setError("The outline was not created.");
    } finally {
      setPending(false);
    }
  }

  if (modules.length === 0) {
    return <p className="text-sm">This institute has no module yet. Add one on the concept map before writing a lesson.</p>;
  }

  return (
    <form className="max-w-[65ch] space-y-4" onSubmit={onSubmit}>
      <p className="text-sm">Step 1. Configure the lesson. The next step generates an outline you can edit.</p>
      <div>
        <Label htmlFor="module">Module</Label>
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          id="module"
          value={moduleId}
          onChange={(event) => setModuleId(event.target.value)}
        >
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="concept">Concept</Label>
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          id="concept"
          value={selectedConcept}
          onChange={(event) => setConceptId(event.target.value)}
        >
          {conceptChoices.map((concept) => (
            <option key={concept.id} value={concept.id}>
              {concept.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="topic">Topic</Label>
        <Input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} required maxLength={200} />
      </div>
      <div>
        <Label htmlFor="objectives">Learning objectives</Label>
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          id="objectives"
          value={objectives}
          onChange={(event) => setObjectives(event.target.value)}
          required
          maxLength={2000}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="level">Learner level</Label>
          <Input id="level" value={learnerLevel} onChange={(event) => setLearnerLevel(event.target.value)} required maxLength={40} />
        </div>
        <div>
          <Label htmlFor="duration">Length in minutes</Label>
          <Input
            id="duration"
            inputMode="numeric"
            min={5}
            max={90}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="code-language">Programming language for examples</Label>
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          id="code-language"
          value={codeLanguage}
          onChange={(event) => setCodeLanguage(event.target.value)}
        >
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java, syntax not checked</option>
          <option value="cpp">C++, syntax not checked</option>
        </select>
        <p className="mt-1 text-sm">Explanations are in English. Assessment execution stays Java, JavaScript, and C++. Hindi explanations are not available.</p>
      </div>
      <div>
        <Label htmlFor="source">Source material, optional</Label>
        <textarea
          className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          id="source"
          value={sourceMaterial}
          onChange={(event) => setSourceMaterial(event.target.value)}
          maxLength={8000}
        />
        <p className="mt-1 text-sm">Paste text. File upload is not part of this version.</p>
      </div>
      {error ? <p className="text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending || !selectedConcept}>
        {pending ? "Generating the outline…" : "Generate outline"}
      </Button>
    </form>
  );
}
