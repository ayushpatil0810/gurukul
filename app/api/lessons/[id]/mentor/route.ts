import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse } from "@/lib/errors";
import { assertValidInput } from "@/lib/validations/validate";
import { readLessonForAuthor, readLessonForStudent } from "@/lib/services/lessons";
import { askMentor } from "@/lib/engine/lesson-mentor";

const mentorRequestSchema = z.object({
  sceneTitle: z.string().trim().min(1).max(200),
  sceneRole: z.string().trim().min(1).max(50),
  conceptName: z.string().trim().max(200).optional(),
  lessonTitle: z.string().trim().max(200).optional(),
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
      })
    )
    .max(10)
    .optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;

    // Verify access to the lesson
    let lessonTitle = "Lesson";
    let conceptName = "Concept";

    if (actor.role === "student") {
      const studentView = await readLessonForStudent(actor, id);
      lessonTitle = studentView.title;
      conceptName = studentView.conceptName;
    } else {
      const authorView = await readLessonForAuthor(actor, id);
      lessonTitle = authorView.title;
      conceptName = authorView.conceptName;
    }

    const body = assertValidInput(mentorRequestSchema, await request.json());

    const result = await askMentor({
      lessonTitle: body.lessonTitle || lessonTitle,
      conceptName: body.conceptName || conceptName,
      sceneTitle: body.sceneTitle,
      sceneRole: body.sceneRole,
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
