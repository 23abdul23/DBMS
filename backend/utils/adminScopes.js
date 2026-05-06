const SAC_ADMIN_EMAILS = ["sacAdmin@iiita.ac.in", "sac@iiita.ac.in"]
const LIBRARY_ADMIN_EMAILS = ["libAdmin@iiita.ac.in", "library@iiita.ac.in"]
const SAC_ADMIN_EMAIL = SAC_ADMIN_EMAILS[0]
const LIBRARY_ADMIN_EMAIL = LIBRARY_ADMIN_EMAILS[0]

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()

const matchesAnyEmail = (value, emails) =>
  emails.some((email) => normalizeEmail(value) === normalizeEmail(email))

const isSacAdminEmail = (value) => matchesAnyEmail(value, SAC_ADMIN_EMAILS)
const isLibraryAdminEmail = (value) =>
  matchesAnyEmail(value, LIBRARY_ADMIN_EMAILS)

const isSacAdministrator = (user) => isSacAdminEmail(user?.email)
const isLibraryAdministrator = (user) => isLibraryAdminEmail(user?.email)

const canViewFullSacActivity = (user) => {
  return Boolean(user) && user.role !== "student"
}
const canViewFullLibraryActivity = (user) =>
  Boolean(user) && (user.role === "security" || isLibraryAdministrator(user))

module.exports = {
  SAC_ADMIN_EMAILS,
  LIBRARY_ADMIN_EMAILS,
  SAC_ADMIN_EMAIL,
  LIBRARY_ADMIN_EMAIL,
  normalizeEmail,
  isSacAdminEmail,
  isLibraryAdminEmail,
  isSacAdministrator,
  isLibraryAdministrator,
  canViewFullSacActivity,
  canViewFullLibraryActivity,
}
