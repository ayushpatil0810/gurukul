import { describe, expect, it } from "vitest";
import { forceStudentOnCreate, stripPrivilegedUserFields } from "@/lib/auth-fields";
import { decideReplayRead, decideStudentRead, type AccessActor, type StudentRecord } from "@/lib/auth/access";

const institute = "inst-1";

function actor(partial: Partial<AccessActor> & Pick<AccessActor, "id" | "role">): AccessActor {
  return { instituteId: institute, ...partial };
}

function student(partial: Partial<StudentRecord> & Pick<StudentRecord, "id">): StudentRecord {
  return { role: "student", instituteId: institute, ...partial };
}

describe("student data access", () => {
  it("lets a student read their own row", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "s1", role: "student" }),
        student: student({ id: "s1" }),
        sharesBatch: false,
      }),
    ).toBe("allow");
  });

  it("refuses a student reading another student in the same institute", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "s1", role: "student" }),
        student: student({ id: "s2" }),
        sharesBatch: true,
      }),
    ).toBe("forbidden");
  });

  it("hides students from another institute", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "s1", role: "student" }),
        student: student({ id: "s2", instituteId: "other" }),
        sharesBatch: false,
      }),
    ).toBe("not_found");
  });

  it("lets a trainer read a student who shares a batch", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "t1", role: "trainer" }),
        student: student({ id: "s1" }),
        sharesBatch: true,
      }),
    ).toBe("allow");
  });

  it("refuses a trainer reading a student outside their batches", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "t1", role: "trainer" }),
        student: student({ id: "s1" }),
        sharesBatch: false,
      }),
    ).toBe("forbidden");
  });

  it("lets an admin read any student in the institute", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "a1", role: "admin" }),
        student: student({ id: "s1" }),
        sharesBatch: false,
      }),
    ).toBe("allow");
  });

  it("does not treat another trainer as a student record", () => {
    expect(
      decideStudentRead({
        actor: actor({ id: "a1", role: "admin" }),
        student: student({ id: "t2", role: "trainer" }),
        sharesBatch: false,
      }),
    ).toBe("not_found");
  });
});

describe("replay access", () => {
  const session = { instituteId: institute, studentId: "s1" };

  it("refuses a student, including the student who owns the session", () => {
    expect(decideReplayRead({ actor: actor({ id: "s1", role: "student" }), session, sharesBatch: true })).toBe(
      "forbidden",
    );
    expect(decideReplayRead({ actor: actor({ id: "s2", role: "student" }), session, sharesBatch: true })).toBe(
      "forbidden",
    );
  });

  it("hides a session from another institute", () => {
    expect(
      decideReplayRead({
        actor: actor({ id: "t1", role: "trainer" }),
        session: { instituteId: "other", studentId: "s1" },
        sharesBatch: true,
      }),
    ).toBe("not_found");
    expect(decideReplayRead({ actor: actor({ id: "t1", role: "trainer" }), session: null, sharesBatch: false })).toBe(
      "not_found",
    );
  });

  it("lets a trainer read a shared batch and an admin read the institute", () => {
    expect(decideReplayRead({ actor: actor({ id: "t1", role: "trainer" }), session, sharesBatch: true })).toBe("allow");
    expect(decideReplayRead({ actor: actor({ id: "t1", role: "trainer" }), session, sharesBatch: false })).toBe(
      "forbidden",
    );
    expect(decideReplayRead({ actor: actor({ id: "a1", role: "admin" }), session, sharesBatch: false })).toBe("allow");
  });
});

describe("privileged user fields", () => {
  it("forces public sign-up to student with no institute", () => {
    expect(
      forceStudentOnCreate({
        name: "Ada",
        email: "ada@example.com",
        role: "admin",
        instituteId: "inst-1",
      }),
    ).toMatchObject({ role: "student", instituteId: null });
  });

  it("drops role and institute from profile updates", () => {
    expect(
      stripPrivilegedUserFields({
        name: "Ada",
        role: "admin",
        instituteId: "inst-1",
      }),
    ).toEqual({ name: "Ada" });
  });
});
