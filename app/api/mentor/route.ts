import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { assertValidInput } from "@/lib/validations/validate";
import { askMentor } from "@/lib/engine/lesson-mentor";

const dashboardMentorSchema = z.object({
  conceptName: z.string().trim().max(200).optional(),
  lessonTitle: z.string().trim().max(200).optional(),
  sceneTitle: z.string().trim().max(200).optional(),
  sceneRole: z.string().trim().max(50).optional(),
  selectedEntity: z.string().trim().max(200).nullable().optional(),
  visibleLogs: z.string().trim().max(1000).nullable().optional(),
  action: z.enum([
    "explain",
    "simplify",
    "hint",
    "explain_logs",
    "example",
    "quiz_me",
    "freeform",
  ]),
  question: z.string().trim().max(500).nullable().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().max(1000),
      }),
    )
    .max(10)
    .optional(),
});

export async function POST(request: Request) {
  try {
    await requireActor();
    const body = assertValidInput(dashboardMentorSchema, await request.json());

    const result = await askMentor({
      lessonTitle: body.lessonTitle ?? "Dashboard Learning Path",
      conceptName: body.conceptName ?? "Software Engineering Fundamentals",
      sceneTitle: body.sceneTitle ?? "Adaptive Practice & Roadmap",
      sceneRole: body.sceneRole ?? "student_dashboard",
      selectedEntity: body.selectedEntity,
      visibleLogs: body.visibleLogs,
      action: body.action,
      question: body.question,
      history: body.history,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
