const SAC_ADMIN_EMAIL = "sacAdmin@iiita.ac.in"
const LIBRARY_ADMIN_EMAIL = "libAdmin@iiita.ac.in"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

const isSacAdminEmail = (value) => normalizeEmail(value) === normalizeEmail(SAC_ADMIN_EMAIL)
const isLibraryAdminEmail = (value) => normalizeEmail(value) === normalizeEmail(LIBRARY_ADMIN_EMAIL)

const isSacAdministrator = (user) => isSacAdminEmail(user?.email)
const isLibraryAdministrator = (user) => isLibraryAdminEmail(user?.email)

const canViewFullSacActivity = (user) =>
  Boolean(user) && (user.role === "security" || isSacAdministrator(user))

const canViewFullLibraryActivity = (user) =>
  Boolean(user) && (user.role === "security" || isLibraryAdministrator(user))

module.exports = {
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
