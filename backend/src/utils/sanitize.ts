/**
 * ==============================================================================
 * Patient Medical Privacy & Redaction Utility (src/utils/sanitize.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * In healthcare systems, patient privacy (PHI - Protected Health Information) is paramount.
 * While doctors and intake nurses need to see the patient's full name, age, and clinical notes,
 * city traffic police officers only need to know that an emergency is occurring.
 *
 * This function redacts sensitive patient details (replacing name with "Restricted"
 * and hiding notes) when broadcasting to non-clinical roles.
 * ==============================================================================
 */

export function publicPatient(patient: {
  id: string;
  displayName: string;
  age: number | null;
  gender: string | null;
  notes: string | null;
  emergencyType: string;
}, canSeePhi: boolean) {
  // If the recipient is authorized clinical staff (Hospital Doctor / Nurse), return full details
  if (canSeePhi) return patient;

  // Otherwise, redact all personal identifying information for privacy
  return {
    id: patient.id,
    displayName: "Restricted",
    age: null,
    gender: null,
    notes: null,
    emergencyType: patient.emergencyType,
  };
}
