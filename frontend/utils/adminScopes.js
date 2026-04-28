export const SAC_ADMIN_EMAIL = "sacAdmin@iiita.ac.in"
export const LIBRARY_ADMIN_EMAIL = "libAdmin@iiita.ac.in"

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

export const isSacAdministrator = (user) => normalizeEmail(user?.email) === normalizeEmail(SAC_ADMIN_EMAIL)
export const isLibraryAdministrator = (user) => normalizeEmail(user?.email) === normalizeEmail(LIBRARY_ADMIN_EMAIL)

export const getScopedAdminLabel = (user) => {
  if (isSacAdministrator(user)) {
    return "SAC Administrator"
  }

  if (isLibraryAdministrator(user)) {
    return "Library Administrator"
  }

  if (user?.role === "admin") {
    return "Admin"
  }

  return null
}
