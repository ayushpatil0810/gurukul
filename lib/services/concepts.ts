import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  concepts,
  moduleConcepts,
  modules,
  prerequisites,
  questionConcepts,
} from "@/db/schema";
import { assertActorRole, type Actor } from "@/lib/auth/actor";
import { checkPrerequisiteEdge } from "@/lib/engine/cycles";
import { AppError } from "@/lib/errors";

function instituteIdOf(actor: Actor): string {
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute");
  }
  return actor.instituteId;
}

export async function listConceptMap(actor: Actor) {
  const instituteId = instituteIdOf(actor);
  const [conceptRows, edgeRows, moduleRows, linkRows] = await Promise.all([
    db.select().from(concepts).where(eq(concepts.instituteId, instituteId)),
    db.select().from(prerequisites).where(eq(prerequisites.instituteId, instituteId)),
    db.select().from(modules).where(eq(modules.instituteId, instituteId)),
    db.select().from(moduleConcepts).where(eq(moduleConcepts.instituteId, instituteId)),
  ]);

  return {
    concepts: conceptRows.map((concept) => ({
      id: concept.id,
      name: concept.name,
      description: concept.description,
    })),
    prerequisites: edgeRows.map((edge) => ({
      conceptId: edge.conceptId,
      requiresId: edge.requiresId,
    })),
    modules: moduleRows.map((module) => ({
      id: module.id,
      name: module.name,
      goalConceptId: module.goalConceptId,
      masteryThreshold: module.masteryThreshold,
      conceptIds: linkRows
        .filter((link) => link.moduleId === module.id)
        .map((link) => link.conceptId),
    })),
  };
}

export async function createConcept(
  actor: Actor,
  input: { name: string; description?: string; moduleId?: string },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const description = input.description ?? "";

  const [existing] = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, input.name)))
    .limit(1);
  if (existing) throw AppError.conflict("A concept with that name already exists");

  if (input.moduleId) {
    const [module] = await db
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.id, input.moduleId), eq(modules.instituteId, instituteId)))
      .limit(1);
    if (!module) throw AppError.notFound("Module not found");
  }

  const [created] = await db
    .insert(concepts)
    .values({ instituteId, name: input.name, description })
    .returning({ id: concepts.id, name: concepts.name, description: concepts.description });

  if (!created) throw AppError.internal();

  if (input.moduleId) {
    await db.insert(moduleConcepts).values({
      moduleId: input.moduleId,
      conceptId: created.id,
      instituteId,
    });
  }

  return created;
}

export async function updateConcept(
  actor: Actor,
  conceptId: string,
  input: { name?: string; description?: string },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const [current] = await db
    .select()
    .from(concepts)
    .where(and(eq(concepts.id, conceptId), eq(concepts.instituteId, instituteId)))
    .limit(1);
  if (!current) throw AppError.notFound("Concept not found");

  if (input.name && input.name !== current.name) {
    const [clash] = await db
      .select({ id: concepts.id })
      .from(concepts)
      .where(and(eq(concepts.instituteId, instituteId), eq(concepts.name, input.name)))
      .limit(1);
    if (clash) throw AppError.conflict("A concept with that name already exists");
  }

  const [updated] = await db
    .update(concepts)
    .set({
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      updatedAt: new Date(),
    })
    .where(eq(concepts.id, conceptId))
    .returning({ id: concepts.id, name: concepts.name, description: concepts.description });

  return updated;
}

export async function deleteConcept(actor: Actor, conceptId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const [current] = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(and(eq(concepts.id, conceptId), eq(concepts.instituteId, instituteId)))
    .limit(1);
  if (!current) throw AppError.notFound("Concept not found");

  const [tagged] = await db
    .select({ conceptId: questionConcepts.conceptId })
    .from(questionConcepts)
    .where(eq(questionConcepts.conceptId, conceptId))
    .limit(1);
  const [goal] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.goalConceptId, conceptId))
    .limit(1);
  const [linked] = await db
    .select({ conceptId: moduleConcepts.conceptId })
    .from(moduleConcepts)
    .where(eq(moduleConcepts.conceptId, conceptId))
    .limit(1);

  if (tagged || goal || linked) {
    throw AppError.conflict(
      "Remove this concept from modules and questions before deleting it",
    );
  }

  await db.delete(concepts).where(eq(concepts.id, conceptId));
}

export async function addPrerequisite(actor: Actor, conceptId: string, requiresId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);

  const conceptRows = await db
    .select({ id: concepts.id, name: concepts.name })
    .from(concepts)
    .where(eq(concepts.instituteId, instituteId));
  const names = new Map(conceptRows.map((concept) => [concept.id, concept.name]));
  if (!names.has(conceptId) || !names.has(requiresId)) {
    throw AppError.notFound("Concept not found");
  }

  const edgeRows = await db
    .select({ conceptId: prerequisites.conceptId, requiresId: prerequisites.requiresId })
    .from(prerequisites)
    .where(eq(prerequisites.instituteId, instituteId));

  if (edgeRows.some((edge) => edge.conceptId === conceptId && edge.requiresId === requiresId)) {
    throw AppError.conflict(
      `${names.get(requiresId)} is already a prerequisite of ${names.get(conceptId)}`,
    );
  }

  const cycle = checkPrerequisiteEdge(edgeRows, conceptId, requiresId, names);
  if (!cycle.ok) throw AppError.conflict(cycle.message);

  await db.insert(prerequisites).values({ conceptId, requiresId, instituteId });
  return { conceptId, requiresId };
}

export async function removePrerequisite(actor: Actor, conceptId: string, requiresId: string) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const deleted = await db
    .delete(prerequisites)
    .where(
      and(
        eq(prerequisites.conceptId, conceptId),
        eq(prerequisites.requiresId, requiresId),
        eq(prerequisites.instituteId, instituteId),
      ),
    )
    .returning({ conceptId: prerequisites.conceptId });
  if (deleted.length === 0) throw AppError.notFound("Prerequisite not found");
}

export async function createModule(
  actor: Actor,
  input: {
    name: string;
    goalConceptId: string;
    masteryThreshold: number;
    conceptIds: string[];
  },
) {
  assertActorRole(actor, ["trainer", "admin"]);
  const instituteId = instituteIdOf(actor);
  const uniqueConceptIds = [...new Set(input.conceptIds)];
  if (!uniqueConceptIds.includes(input.goalConceptId)) {
    throw AppError.validation("The goal concept must be part of the module");
  }

  const conceptRows = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(eq(concepts.instituteId, instituteId));
  const known = new Set(conceptRows.map((concept) => concept.id));
  if (uniqueConceptIds.some((id) => !known.has(id))) {
    throw AppError.notFound("Concept not found");
  }

  const [created] = await db
    .insert(modules)
    .values({
      instituteId,
      name: input.name,
      goalConceptId: input.goalConceptId,
      masteryThreshold: input.masteryThreshold,
    })
    .returning({
      id: modules.id,
      name: modules.name,
      goalConceptId: modules.goalConceptId,
      masteryThreshold: modules.masteryThreshold,
    });
  if (!created) throw AppError.internal();

  await db.insert(moduleConcepts).values(
    uniqueConceptIds.map((conceptId) => ({
      moduleId: created.id,
      conceptId,
      instituteId,
    })),
  );

  return { ...created, conceptIds: uniqueConceptIds };
}
