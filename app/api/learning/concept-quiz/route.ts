import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { masteryState, masteryUpdates } from "@/db/schema";
import { requireActor } from "@/lib/auth/actor";
import { apiErrorResponse, AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role !== "student") {
      throw AppError.forbidden("Only enrolled students can record concept quiz mastery.");
    }
    if (!actor.instituteId) {
      throw AppError.forbidden("Your account is not assigned to an institute.");
    }

    const body = await request.json();
    const { conceptId, scorePercent, correctCount, totalQuestions } = body;

    if (!conceptId || typeof scorePercent !== "number") {
      throw AppError.badRequest("Invalid request body. conceptId and scorePercent are required.");
    }

    const MINIMUM_PASSING_SCORE = 70;
    const isPassed = scorePercent >= MINIMUM_PASSING_SCORE;

    if (!isPassed) {
      return NextResponse.json({
        success: true,
        passed: false,
        scorePercent,
        requiredScore: MINIMUM_PASSING_SCORE,
        repeatRequired: true,
        message: `Score of ${scorePercent}% is below the required ${MINIMUM_PASSING_SCORE}%. Retake is mandatory to achieve passing mastery.`,
      });
    }

    // Calibrate pKnow (mastery probability between 0.70 and 0.95 based on quiz score)
    const normalizedMastery = Math.max(0.7, Math.min(0.95, scorePercent / 100));

    // Check existing mastery row
    const [existing] = await db
      .select({ pKnow: masteryState.pKnow, confidence: masteryState.confidence })
      .from(masteryState)
      .where(
        and(
          eq(masteryState.studentId, actor.id),
          eq(masteryState.conceptId, conceptId),
          eq(masteryState.instituteId, actor.instituteId),
        ),
      )
      .limit(1);

    const beforeScore = existing?.pKnow ?? 0;
    const finalPKnow = existing ? Math.max(existing.pKnow, normalizedMastery) : normalizedMastery;
    const newConfidence = Math.min(1.0, (existing?.confidence ?? 0.4) + 0.15);

    if (existing) {
      await db
        .update(masteryState)
        .set({
          pKnow: finalPKnow,
          confidence: newConfidence,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(masteryState.studentId, actor.id),
            eq(masteryState.conceptId, conceptId),
            eq(masteryState.instituteId, actor.instituteId),
          ),
        );
    } else {
      await db.insert(masteryState).values({
        studentId: actor.id,
        conceptId,
        instituteId: actor.instituteId,
        pKnow: finalPKnow,
        confidence: newConfidence,
      });
    }

    // Record audit trail in masteryUpdates
    await db.insert(masteryUpdates).values({
      instituteId: actor.instituteId,
      studentId: actor.id,
      conceptId,
      before: beforeScore,
      after: finalPKnow,
      causeType: "attempt",
    });

    return NextResponse.json({
      success: true,
      passed: true,
      scorePercent,
      pKnow: finalPKnow,
      message: "Concept quiz passed! Mastery standing updated.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
