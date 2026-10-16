import type { DBFieldAttribute } from "@better-auth/core/db";

export const ROLES = ["student", "trainer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const portalUserFields = {
  role: {
    type: "string",
    required: true,
    defaultValue: "student",
    input: false,
  },
  instituteId: {
    type: "string",
    required: false,
    input: false,
  },
} as const satisfies Record<string, DBFieldAttribute>;

export function isRole(value: unknown): value is Role {
  return value === "student" || value === "trainer" || value === "admin";
}

export function parseRole(value: unknown): Role {
  if (isRole(value)) return value;
  throw new Error("Stored role is not a supported application role");
}

/** Public sign-up cannot choose a role or an institute. */
export function forceStudentOnCreate<T extends Record<string, unknown>>(
  input: T,
): T & { role: "student"; instituteId: null } {
  return {
    ...input,
    role: "student",
    instituteId: null,
  };
}

/** Profile updates cannot change role or institute membership. */
export function stripPrivilegedUserFields<T extends Record<string, unknown>>(
  input: T,
): Omit<T, "role" | "instituteId"> {
  const rest = { ...input };
  delete rest.role;
  delete rest.instituteId;
  return rest;
}
