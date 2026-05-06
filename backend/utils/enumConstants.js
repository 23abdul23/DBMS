/**
 * Backend Enum Mappings Documentation
 * These match the Prisma schema enum values
 *
 * The backend receives and sends UPPERCASE enum values.
 * Frontend handles conversion to/from user-friendly labels.
 */

// Academic Year enum values (as stored in database)
export const AcademicYearEnum = {
  FIRST_YEAR: "FIRST_YEAR",
  SECOND_YEAR: "SECOND_YEAR",
  THIRD_YEAR: "THIRD_YEAR",
  FOURTH_YEAR: "FOURTH_YEAR",
}

// Backend mapping for normalizing user input to enum values
// This accepts various input formats and normalizes them to uppercase enum values
export const yearNormalizationMap = {
  1: "FIRST_YEAR",
  2: "SECOND_YEAR",
  3: "THIRD_YEAR",
  4: "FOURTH_YEAR",
  year1: "FIRST_YEAR",
  year2: "SECOND_YEAR",
  year3: "THIRD_YEAR",
  year4: "FOURTH_YEAR",
  year_1: "FIRST_YEAR",
  year_2: "SECOND_YEAR",
  year_3: "THIRD_YEAR",
  year_4: "FOURTH_YEAR",
  "1st year": "FIRST_YEAR",
  "2nd year": "SECOND_YEAR",
  "3rd year": "THIRD_YEAR",
  "4th year": "FOURTH_YEAR",
  first_year: "FIRST_YEAR",
  second_year: "SECOND_YEAR",
  third_year: "THIRD_YEAR",
  fourth_year: "FOURTH_YEAR",
  FIRST_YEAR: "FIRST_YEAR",
  SECOND_YEAR: "SECOND_YEAR",
  THIRD_YEAR: "THIRD_YEAR",
  FOURTH_YEAR: "FOURTH_YEAR",
}

// User Role enum values
export const UserRoleEnum = {
  student: "student",
  warden: "warden",
  security: "security",
  admin: "admin",
}

// Gender enum values
export const GenderEnum = {
  male: "male",
  female: "female",
  other: "other",
}

// Department enum values
export const DepartmentEnum = {
  IT: "IT",
  IT_BI: "IT_BI",
  Electronics: "Electronics",
}
