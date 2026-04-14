export const APP_USER_ROLES = [
  "INDIVIDUAL",
  "EMPLOYER",
  "RECRUITER",
  "ADMIN",
] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

export const STANDARD_PROTECTED_ROLES: ReadonlyArray<AppUserRole> = APP_USER_ROLES;

export const ADMIN_ROLES: ReadonlyArray<AppUserRole> = ["ADMIN"];

export const PAID_ROLES: ReadonlyArray<AppUserRole> = ["EMPLOYER", "RECRUITER"];
