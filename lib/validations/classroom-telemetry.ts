import { z } from "zod";
import { classroomEventTypes } from "@/lib/services/events";

const MAX_PAYLOAD_BYTES = 16_384;
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "password",
  "secret",
  "apiKey",
  "api_key",
  "token",
  "referenceSolution",
  "reference_solution",
  "hiddenTests",
  "hidden_tests",
  "fullTranscript",
  "userPromptText",
  "rawAnswerKey",
]);

const lessonStartPayloadSchema = z.object({
  sceneCount: z.number().int().nonnegative().optional(),
});

const lessonCompletePayloadSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
  scenesViewed: z.number().int().nonnegative().optional(),
  totalScenes: z.number().int().nonnegative().optional(),
});

const sceneViewPayloadSchema = z.object({
  sceneIndex: z.number().int().nonnegative(),
  role: z.string().max(64).optional(),
  title: z.string().max(256).optional(),
});

const sceneNavPayloadSchema = z.object({
  fromIndex: z.number().int().nonnegative(),
  toIndex: z.number().int().nonnegative(),
  direction: z.enum(["next", "prev", "jump"]),
});

const diagramNodeInspectPayloadSchema = z.object({
  nodeId: z.string().max(128),
  nodeLabel: z.string().max(256),
  category: z.string().max(128).optional(),
});

const stepperStepPayloadSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  totalSteps: z.number().int().positive(),
  completed: z.boolean().optional(),
});

const walkthroughStepPayloadSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  totalSteps: z.number().int().positive(),
});

const dockerLabActionPayloadSchema = z.object({
  action: z.enum(["build", "run", "health_check", "reset"]),
  status: z.string().max(64).optional(),
  passed: z.boolean().optional(),
});

const cicdLabRunPayloadSchema = z.object({
  stage: z.number().int().nonnegative(),
  stageName: z.string().max(128),
  passed: z.boolean(),
  gateOutcome: z.enum(["proceed", "blocked"]),
});

const k8sLabActionPayloadSchema = z.object({
  action: z.enum(["scale", "simulate_failure", "recover", "inspect_pod", "reset"]),
  replicas: z.number().int().min(1).max(10).optional(),
  podName: z.string().max(128).optional(),
  outcome: z.enum(["degraded", "recovered", "scaled", "normal"]).optional(),
});

const quizSubmitPayloadSchema = z.object({
  questionId: z.string().max(128),
  selectedOption: z.string().max(512),
  isCorrect: z.boolean(),
});

const quizRetryPayloadSchema = z.object({
  questionId: z.string().max(128),
  attemptCount: z.number().int().positive().optional(),
});

const mentorOpenPayloadSchema = z.object({
  sceneTitle: z.string().max(256).optional(),
});

const mentorActionPayloadSchema = z.object({
  action: z.enum(["explain", "hint", "deep-dive"]),
  promptCategory: z.string().max(128).optional(),
});

const mentorReplyPayloadSchema = z.object({
  action: z.string().max(64),
  status: z.enum(["success", "fallback"]),
});

const recommendationViewPayloadSchema = z.object({
  conceptId: z.string().max(128),
  activityType: z.string().max(64),
  activityId: z.string().max(128).nullable().optional(),
});

const recommendationClickPayloadSchema = z.object({
  conceptId: z.string().max(128),
  activityType: z.string().max(64),
  activityId: z.string().max(128).nullable().optional(),
  destinationHref: z.string().max(512).nullable().optional(),
});

const classroomEventItemSchema = z.object({
  seq: z.number().int().positive().max(1_000_000),
  t: z.number().finite().gte(-86_400_000).lte(31_536_000_000),
  type: z.enum(classroomEventTypes),
  sceneId: z.string().trim().max(128).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const classroomTelemetryBatchSchema = z.object({
  lessonId: z.string().trim().min(1).max(128),
  sessionId: z.string().trim().max(128).nullable().optional(),
  events: z.array(classroomEventItemSchema).min(1).max(50),
});

export type ClassroomTelemetryBatchInput = z.infer<typeof classroomTelemetryBatchSchema>;
export type ClassroomEventItemInput = z.infer<typeof classroomEventItemSchema>;

export function sanitizeAndValidateClassroomPayload(
  type: (typeof classroomEventTypes)[number],
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const jsonString = JSON.stringify(payload);
  if (jsonString.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`Payload size (${jsonString.length} bytes) exceeds maximum allowed limit of ${MAX_PAYLOAD_BYTES} bytes.`);
  }

  const cleanPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) continue;
    cleanPayload[key] = value;
  }

  switch (type) {
    case "lesson_start":
      return lessonStartPayloadSchema.parse(cleanPayload);
    case "lesson_complete":
      return lessonCompletePayloadSchema.parse(cleanPayload);
    case "scene_view":
      return sceneViewPayloadSchema.parse(cleanPayload);
    case "scene_nav":
      return sceneNavPayloadSchema.parse(cleanPayload);
    case "diagram_node_inspect":
      return diagramNodeInspectPayloadSchema.parse(cleanPayload);
    case "stepper_step":
      return stepperStepPayloadSchema.parse(cleanPayload);
    case "walkthrough_step":
      return walkthroughStepPayloadSchema.parse(cleanPayload);
    case "docker_lab_action":
      return dockerLabActionPayloadSchema.parse(cleanPayload);
    case "cicd_lab_run":
      return cicdLabRunPayloadSchema.parse(cleanPayload);
    case "k8s_lab_action":
      return k8sLabActionPayloadSchema.parse(cleanPayload);
    case "quiz_submit":
      return quizSubmitPayloadSchema.parse(cleanPayload);
    case "quiz_retry":
      return quizRetryPayloadSchema.parse(cleanPayload);
    case "mentor_open":
      return mentorOpenPayloadSchema.parse(cleanPayload);
    case "mentor_action":
      return mentorActionPayloadSchema.parse(cleanPayload);
    case "mentor_reply":
      return mentorReplyPayloadSchema.parse(cleanPayload);
    case "recommendation_view":
      return recommendationViewPayloadSchema.parse(cleanPayload);
    case "recommendation_click":
      return recommendationClickPayloadSchema.parse(cleanPayload);
    default:
      return cleanPayload;
  }
}
