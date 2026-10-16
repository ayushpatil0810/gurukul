export type PreviewQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string | null;
};

export type LessonBlock =
  | { kind: "prose"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "steps"; steps: string[] }
  | { kind: "comparison"; headers: string[]; rows: string[][] };

export type SceneRole =
  | "introduction"
  | "intro"
  | "explanation"
  | "diagram"
  | "code_walkthrough"
  | "code"
  | "comparison"
  | "step_by_step"
  | "steps"
  | "interactive_lab"
  | "knowledge_check"
  | "check"
  | "summary";

export type DiagramNode = {
  id: string;
  label: string;
  description: string;
  category?: "source" | "build" | "test" | "registry" | "deploy" | "monitor" | "infra";
  status?: "healthy" | "active" | "idle" | "warning";
  metadata?: Record<string, string>;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
};

export type ArchitectureDiagramData = {
  title?: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type TeachingStep = {
  id: string;
  title: string;
  explanation: string;
  diagramHighlightNodeIds?: string[];
  callout?: string;
};

export type StepByStepData = {
  title?: string;
  steps: TeachingStep[];
};

export type CodeWalkthroughAnnotation = {
  lineStart: number;
  lineEnd: number;
  title: string;
  explanation: string;
};

export type CodeWalkthroughData = {
  title?: string;
  language: string;
  code: string;
  filename?: string;
  annotations: CodeWalkthroughAnnotation[];
};

export type InteractiveLabData =
  | {
      kind: "k8s";
      initialReplicas?: number;
      maxReplicas?: number;
      minReplicas?: number;
      scenario?: "readiness_probe_failure" | "normal";
    }
  | {
      kind: "docker";
      initialStage?: string;
    }
  | {
      kind: "cicd";
      stages?: string[];
      allowFailureSimulation?: boolean;
    };

export type PreviewScene = {
  id: string;
  outlineId: string;
  type: "slide" | "quiz" | "interactive";
  role: SceneRole;
  title: string;
  paragraphs: string[];
  blocks: LessonBlock[];
  questions: PreviewQuestion[];
  diagram?: ArchitectureDiagramData;
  stepper?: StepByStepData;
  walkthrough?: CodeWalkthroughData;
  lab?: InteractiveLabData;
};

function textFromHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractDiagram(content: Record<string, unknown>, config?: Record<string, unknown> | null): ArchitectureDiagramData | undefined {
  const raw = asRecord(content.diagram) ?? asRecord(config?.diagram);
  if (!raw || !Array.isArray(raw.nodes)) return undefined;
  const nodes: DiagramNode[] = [];
  for (const item of raw.nodes) {
    const node = asRecord(item);
    if (!node || typeof node.id !== "string" || typeof node.label !== "string") continue;
    nodes.push({
      id: node.id,
      label: node.label,
      description: typeof node.description === "string" ? node.description : "",
      category: typeof node.category === "string" ? (node.category as DiagramNode["category"]) : undefined,
      status: typeof node.status === "string" ? (node.status as DiagramNode["status"]) : undefined,
      metadata: asRecord(node.metadata) as Record<string, string> | undefined,
    });
  }
  const edges: DiagramEdge[] = [];
  if (Array.isArray(raw.edges)) {
    for (const item of raw.edges) {
      const edge = asRecord(item);
      if (!edge || typeof edge.from !== "string" || typeof edge.to !== "string") continue;
      edges.push({
        from: edge.from,
        to: edge.to,
        label: typeof edge.label === "string" ? edge.label : undefined,
        animated: typeof edge.animated === "boolean" ? edge.animated : undefined,
      });
    }
  }
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    nodes,
    edges,
  };
}

function extractStepper(content: Record<string, unknown>, config?: Record<string, unknown> | null): StepByStepData | undefined {
  const raw = asRecord(content.stepper) ?? asRecord(config?.stepper);
  if (!raw || !Array.isArray(raw.steps)) return undefined;
  const steps: TeachingStep[] = [];
  for (const item of raw.steps) {
    const step = asRecord(item);
    if (!step || typeof step.id !== "string" || typeof step.title !== "string") continue;
    steps.push({
      id: step.id,
      title: step.title,
      explanation: typeof step.explanation === "string" ? step.explanation : "",
      diagramHighlightNodeIds: Array.isArray(step.diagramHighlightNodeIds)
        ? step.diagramHighlightNodeIds.filter((id): id is string => typeof id === "string")
        : undefined,
      callout: typeof step.callout === "string" ? step.callout : undefined,
    });
  }
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    steps,
  };
}

function extractWalkthrough(content: Record<string, unknown>, config?: Record<string, unknown> | null): CodeWalkthroughData | undefined {
  const raw = asRecord(content.walkthrough) ?? asRecord(config?.walkthrough);
  if (!raw || typeof raw.code !== "string") return undefined;
  const annotations: CodeWalkthroughAnnotation[] = [];
  if (Array.isArray(raw.annotations)) {
    for (const item of raw.annotations) {
      const ann = asRecord(item);
      if (!ann || typeof ann.lineStart !== "number" || typeof ann.lineEnd !== "number") continue;
      annotations.push({
        lineStart: ann.lineStart,
        lineEnd: ann.lineEnd,
        title: typeof ann.title === "string" ? ann.title : "",
        explanation: typeof ann.explanation === "string" ? ann.explanation : "",
      });
    }
  }
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    language: typeof raw.language === "string" ? raw.language : "text",
    code: raw.code,
    filename: typeof raw.filename === "string" ? raw.filename : undefined,
    annotations,
  };
}

function extractLab(content: Record<string, unknown>, config?: Record<string, unknown> | null): InteractiveLabData | undefined {
  const raw = asRecord(content.lab) ?? asRecord(config?.lab) ?? (content.widgetType === "simulation" ? config : null);
  if (!raw) return undefined;
  const kind = raw.kind ?? raw.simulationKind;
  if (kind === "k8s") {
    return {
      kind: "k8s",
      initialReplicas: typeof raw.initialReplicas === "number" ? raw.initialReplicas : 3,
      maxReplicas: typeof raw.maxReplicas === "number" ? raw.maxReplicas : 6,
      minReplicas: typeof raw.minReplicas === "number" ? raw.minReplicas : 1,
      scenario: raw.scenario === "readiness_probe_failure" ? "readiness_probe_failure" : "normal",
    };
  }
  if (kind === "docker") {
    return {
      kind: "docker",
      initialStage: typeof raw.initialStage === "string" ? raw.initialStage : undefined,
    };
  }
  if (kind === "cicd") {
    return {
      kind: "cicd",
      stages: Array.isArray(raw.stages) ? raw.stages.filter((s): s is string => typeof s === "string") : undefined,
      allowFailureSimulation: typeof raw.allowFailureSimulation === "boolean" ? raw.allowFailureSimulation : true,
    };
  }
  return undefined;
}

export function previewScenes(scenes: unknown, includeAnswers: boolean, codeLanguage: string | null = null): PreviewScene[] {
  if (!Array.isArray(scenes)) return [];
  const views: PreviewScene[] = [];
  for (const scene of scenes) {
    const record = asRecord(scene);
    const content = asRecord(record?.content);
    if (!record || !content) continue;
    const type = record.type === "quiz" ? "quiz" : record.type === "interactive" ? "interactive" : record.type === "slide" ? "slide" : null;
    if (!type) continue;
    const title = typeof record.title === "string" ? record.title : "Untitled scene";
    const id = typeof record.id === "string" ? record.id : title;
    const outlineId = typeof record.outlineId === "string" ? record.outlineId : id;
    const widgetConfig = asRecord(content.widgetConfig);
    const explicitRole = typeof record.role === "string" ? (record.role as SceneRole) : undefined;

    if (type === "slide") {
      const canvas = asRecord(content.canvas);
      const elements = Array.isArray(canvas?.elements) ? canvas.elements : [];
      const paragraphs = elements
        .map((element) => {
          const item = asRecord(element);
          if (!item || item.type !== "text" || typeof item.content !== "string") return "";
          return textFromHtml(item.content);
        })
        .filter(Boolean);
      const diagram = extractDiagram(content);
      const stepper = extractStepper(content);
      const walkthrough = extractWalkthrough(content);
      const lab = extractLab(content);
      views.push({
        id,
        outlineId,
        type,
        role: explicitRole ?? (diagram ? "diagram" : stepper ? "step_by_step" : walkthrough ? "code_walkthrough" : lab ? "interactive_lab" : "explanation"),
        title,
        paragraphs,
        blocks: blocksFromParagraphs(paragraphs, codeLanguage),
        questions: [],
        diagram,
        stepper,
        walkthrough,
        lab,
      });
      continue;
    }

    if (type === "interactive") {
      const desc = typeof content.description === "string" ? content.description : typeof widgetConfig?.description === "string" ? widgetConfig.description : "";
      const paragraphs = desc ? [desc] : [];
      const diagram = extractDiagram(content, widgetConfig);
      const stepper = extractStepper(content, widgetConfig);
      const walkthrough = extractWalkthrough(content, widgetConfig);
      const lab = extractLab(content, widgetConfig);
      views.push({
        id,
        outlineId,
        type,
        role: explicitRole ?? (lab ? "interactive_lab" : diagram ? "diagram" : stepper ? "step_by_step" : walkthrough ? "code_walkthrough" : "explanation"),
        title,
        paragraphs,
        blocks: blocksFromParagraphs(paragraphs, codeLanguage),
        questions: [],
        diagram,
        stepper,
        walkthrough,
        lab,
      });
      continue;
    }

    const questions = Array.isArray(content.questions) ? content.questions : [];
    views.push({
      id,
      outlineId,
      type,
      role: explicitRole ?? "check",
      title,
      paragraphs: [],
      blocks: [],
      questions: questions.flatMap((question) => {
        const item = asRecord(question);
        if (!item || typeof item.question !== "string") return [];
        const options = Array.isArray(item.options)
          ? item.options.flatMap((option) => {
              const row = asRecord(option);
              return row && typeof row.label === "string" ? [row.label] : [];
            })
          : [];
        const answer = includeAnswers && Array.isArray(item.answer) ? item.answer.filter((entry) => typeof entry === "string").join(", ") : null;
        return [{ id: typeof item.id === "string" ? item.id : item.question, prompt: item.question, options, answer }];
      }),
    });
  }
  return views.map((scene, index) => {
    if (scene.type === "quiz") return { ...scene, role: scene.role ?? "check" };
    if (scene.diagram) return { ...scene, role: scene.role === "explanation" ? "diagram" : scene.role };
    if (scene.stepper) return { ...scene, role: scene.role === "explanation" ? "step_by_step" : scene.role };
    if (scene.walkthrough) return { ...scene, role: scene.role === "explanation" ? "code_walkthrough" : scene.role };
    if (scene.lab) return { ...scene, role: scene.role === "explanation" ? "interactive_lab" : scene.role };
    if (scene.role && scene.role !== "explanation") return scene;
    return { ...scene, role: roleFor(scene, index) };
  });
}

export function blocksFromParagraphs(paragraphs: string[], codeLanguage: string | null): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  for (const paragraph of paragraphs) {
    const table = parseTable(paragraph);
    if (table) {
      blocks.push(table);
      continue;
    }
    const steps = parseSteps(paragraph);
    if (steps) {
      blocks.push({ kind: "steps", steps });
      continue;
    }
    const samples = extractCode(paragraph);
    if (samples.length === 0) {
      blocks.push({ kind: "prose", text: paragraph });
      continue;
    }
    const prose = paragraph
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !samples.includes(line))
      .join(" ");
    if (prose) blocks.push({ kind: "prose", text: prose });
    for (const sample of samples) blocks.push({ kind: "code", language: codeLanguage ?? "text", code: sample });
  }
  return blocks;
}

function roleFor(scene: PreviewScene, index: number): SceneRole {
  if (scene.blocks.some((block) => block.kind === "code")) return "code";
  if (scene.blocks.some((block) => block.kind === "comparison")) return "comparison";
  if (scene.blocks.some((block) => block.kind === "steps")) return "steps";
  if (/summary|review|recap/i.test(scene.title)) return "summary";
  if (index === 0) return "introduction";
  return "explanation";
}

function parseSteps(paragraph: string): string[] | null {
  const lines = paragraph
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const steps = lines.flatMap((line) => {
    const match = /^(\d+)[.)]\s+(.+)$/.exec(line);
    return match?.[2] ? [match[2]] : [];
  });
  if (steps.length >= 2 && steps.length === lines.length) return steps;
  return null;
}

function parseTable(paragraph: string): LessonBlock | null {
  const lines = paragraph
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));
  if (lines.length < 2) return null;
  const rows = lines
    .filter((line) => !/^\|?\s*:?-{3,}/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean));
  if (rows.length < 2 || rows.some((row) => row.length < 2)) return null;
  const [headers, ...body] = rows;
  if (!headers) return null;
  return { kind: "comparison", headers, rows: body };
}

export function extractCode(text: string): string[] {
  if (text.includes("```")) {
    const fences = [...text.matchAll(/```[a-zA-Z0-9+#]*[ \t]*\n?([\s\S]*?)```/g)].map((match) => match[1]?.trim() ?? "");
    if (fences.length === 0) return [];
    return fences.map((fence) => (fence.length > 0 ? fence : " "));
  }
  const snippets = [
    ...balancedFrom(text, /\b(?:async\s+)?function\s+[A-Za-z_]\w*\s*\([^)]*\)\s*(?::\s*[^{;]+)?\{/g),
    ...balancedFrom(text, /\b(?:const|let)\s+[A-Za-z_]\w*\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>\s*\{/g),
    ...balancedFrom(text, /\b(?:const|let)\s+[A-Za-z_]\w*\s*=\s*\{/g),
    ...balancedFrom(text, /\bclass\s+[A-Za-z_]\w*\s*(?:extends\s+[A-Za-z_]\w*\s*)?\{/g),
    ...balancedFrom(text, /\b(?:int|void|public)\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{/g),
    ...text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => /^(?:const|let)\s+[A-Za-z_]\w*\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>\s*[^{]/.test(line)),
  ];
  return [...new Set(snippets)];
}

function balancedFrom(text: string, pattern: RegExp): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const open = start + match[0].lastIndexOf("{");
    let depth = 0;
    let end = -1;
    for (let index = open; index < text.length && index < open + 2000; index += 1) {
      if (text[index] === "{") depth += 1;
      if (text[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end > open) found.push(text.slice(start, end + 1).trim());
  }
  return found;
}

export function escapeLessonText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
