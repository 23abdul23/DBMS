export const SAC_ADMIN_EMAILS = ['sacAdmin@iiita.ac.in', 'sac@iiita.ac.in'];
export const LIBRARY_ADMIN_EMAILS = [
  'libAdmin@iiita.ac.in',
  'library@iiita.ac.in',
];
export const SECURITY_ADMIN_EMAILS = ['security@iiita.ac.in'];
export const SAC_ADMIN_EMAIL = SAC_ADMIN_EMAILS[0];
export const LIBRARY_ADMIN_EMAIL = LIBRARY_ADMIN_EMAILS[0];
export const SECURITY_ADMIN_EMAIL = SECURITY_ADMIN_EMAILS[0];
export const SUPER_ADMIN_EMAIL = 'adminAegis@iiita.ac.in';

export const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const matchesAnyEmail = (value, emails) =>
  emails.some((email) => normalizeEmail(value) === normalizeEmail(email));

export const isSacAdministrator = (user) =>
  matchesAnyEmail(user?.email, SAC_ADMIN_EMAILS);
export const isLibraryAdministrator = (user) =>
  matchesAnyEmail(user?.email, LIBRARY_ADMIN_EMAILS);
export const isSecurityAdministrator = (user) =>
  matchesAnyEmail(user?.email, SECURITY_ADMIN_EMAILS);
export const isSuperAdministrator = (user) =>
  normalizeEmail(user?.email) === normalizeEmail(SUPER_ADMIN_EMAIL);

export const getScopedAdminLabel = (user) => {
  if (isSecurityAdministrator(user)) {
    return 'Security Administrator';
  }

  if (isSacAdministrator(user)) {
    return 'SAC Administrator';
  }

  if (isLibraryAdministrator(user)) {
    return 'Library Administrator';
  }

  if (user?.role === 'admin') {
    return 'Admin';
  }

  return null;
};
