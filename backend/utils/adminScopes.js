export const SAC_ADMIN_EMAILS = ["sacAdmin@iiita.ac.in", "sac@iiita.ac.in"]
export const LIBRARY_ADMIN_EMAILS = [
  "libAdmin@iiita.ac.in",
  "library@iiita.ac.in",
]
export const SAC_ADMIN_EMAIL = SAC_ADMIN_EMAILS[0]
export const LIBRARY_ADMIN_EMAIL = LIBRARY_ADMIN_EMAILS[0]

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

export const isSacAdministrator = (user) => isSacAdminEmail(user?.email)
export const isLibraryAdministrator = (user) => isLibraryAdminEmail(user?.email)

export const canViewFullSacActivity = (user) => {
  return Boolean(user) && user.role !== "student"
}
export const canViewFullLibraryActivity = (user) =>
  Boolean(user) && (user.role === "security" || isLibraryAdministrator(user))
