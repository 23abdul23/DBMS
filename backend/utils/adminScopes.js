export const SAC_ADMIN_EMAILS = ["sacAdmin@iiita.ac.in", "sac@iiita.ac.in"]
export const LIBRARY_ADMIN_EMAILS = [
  "libAdmin@iiita.ac.in",
  "library@iiita.ac.in",
]

export const SAC_ADMIN_EMAIL = SAC_ADMIN_EMAILS[0]
export const LIBRARY_ADMIN_EMAIL = LIBRARY_ADMIN_EMAILS[0]
export const SECURITY_ADMIN_EMAIL = "security@iiita.ac.in"
export const super_admin_EMAIL = "adminAegis@iiita.ac.in"

export const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()

export const matchesAnyEmail = (value, emails) =>
  emails.some((email) => normalizeEmail(value) === normalizeEmail(email))

export const isSacAdminEmail = (value) =>
  matchesAnyEmail(value, SAC_ADMIN_EMAILS)
export const isLibraryAdminEmail = (value) =>
  matchesAnyEmail(value, LIBRARY_ADMIN_EMAILS)
export const isSecurityAdminEmail = (value) =>
  matchesAnyEmail(value, SECURITY_ADMIN_EMAIL)
export const isSuperAdminEmail = (value) =>
  normalizeEmail(value) === normalizeEmail(super_admin_EMAIL)

export const isSacAdministrator = (user) => isSacAdminEmail(user?.email)
export const isLibraryAdministrator = (user) => isLibraryAdminEmail(user?.email)
export const isSecurityAdministrator = (user) =>
  isSecurityAdminEmail(user?.email)
export const isSuperAdministrator = (user) => isSuperAdminEmail(user?.email)

export const canViewFullSacActivity = (user) => {
  return Boolean(user) && user.role !== "student"
}
export const canViewFullLibraryActivity = (user) =>
  Boolean(user) && (user.role === "security" || isLibraryAdministrator(user))
