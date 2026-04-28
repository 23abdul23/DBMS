/**
 * Centralized enum mappings for Aegis ID
 * Single source of truth for converting between database enums and user-friendly labels
 * 
 * Backend sends/receives: ENUM_VALUE (uppercase)
 * Frontend displays: User-friendly label
 */

export const AcademicYearMap = {
  FIRST_YEAR: "1st Year",
  SECOND_YEAR: "2nd Year",
  THIRD_YEAR: "3rd Year",
  FOURTH_YEAR: "4th Year",
};

export const AcademicYearReverseMap = {
  "1st Year": "FIRST_YEAR",
  "2nd Year": "SECOND_YEAR",
  "3rd Year": "THIRD_YEAR",
  "4th Year": "FOURTH_YEAR",
};

export const AcademicYearList = Object.values(AcademicYearMap);

export const UserRoleMap = {
  student: "Student",
  warden: "Warden",
  security: "Security",
  admin: "Admin",
  sac_admin: "SAC Administrator",
  library_admin: "Library Administrator",
};

export const GenderMap = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export const GenderReverseMap = {
  Male: "male",
  Female: "female",
  Other: "other",
};

export const GenderList = Object.values(GenderMap);

export const DepartmentMap = {
  IT: "IT",
  IT_BI: "IT BI",
  Electronics: "Electronics",
};

export const DepartmentReverseMap = {
  IT: "IT",
  "IT BI": "IT_BI",
  Electronics: "Electronics",
};

export const DepartmentList = Object.values(DepartmentMap);

export const OutpassStatusMap = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const OutpassStatusColors = {
  pending: "#FFA500",
  approved: "#4CAF50",
  rejected: "#F44336",
  expired: "#9E9E9E",
  cancelled: "#FF5722",
};

export const EmergencyTypeMap = {
  medical: "Medical",
  security: "Security",
  fire: "Fire",
  other: "Other",
};

export const EmergencyStatusMap = {
  active: "Active",
  responded: "Responded",
  resolved: "Resolved",
};

export const EmergencyPriorityMap = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

// Helper functions
export const getAcademicYearLabel = (value) => AcademicYearMap[value] || value;
export const getAcademicYearEnum = (label) => AcademicYearReverseMap[label] || label;

export const getUserRoleLabel = (value) => UserRoleMap[value] || value;

export const getGenderLabel = (value) => GenderMap[value] || value;
export const getGenderEnum = (label) => GenderReverseMap[label] || label;

export const getDepartmentLabel = (value) => DepartmentMap[value] || value;
export const getDepartmentEnum = (label) => DepartmentReverseMap[label] || label;

export const getOutpassStatusLabel = (value) => OutpassStatusMap[value] || value;
export const getOutpassStatusColor = (value) => OutpassStatusColors[value] || "#000";

export const getEmergencyTypeLabel = (value) => EmergencyTypeMap[value] || value;
export const getEmergencyStatusLabel = (value) => EmergencyStatusMap[value] || value;
export const getEmergencyPriorityLabel = (value) => EmergencyPriorityMap[value] || value;
