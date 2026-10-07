import "server-only";

/** Display branding for this deployment; it does not determine data access. */
export function getHospitalName(): string {
  return process.env.HOSPITAL_NAME?.trim() || "Hospital Name";
}
