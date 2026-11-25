/**
 * Anonymized research participant IDs, e.g. "P-7492".
 * Must stay in sync with the CHECK constraint in 001_core_schema.sql.
 * Codes are assigned server-side (handle_new_user trigger) to guarantee uniqueness.
 */
export const PARTICIPANT_CODE_PATTERN = /^P-[0-9]{4,8}$/;

export function isParticipantCode(value: unknown): value is string {
  return typeof value === "string" && PARTICIPANT_CODE_PATTERN.test(value);
}
