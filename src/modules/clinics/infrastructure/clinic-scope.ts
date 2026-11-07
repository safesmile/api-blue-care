import type { AccessActor } from "../../authorization/domain/access-policy";
/**
 * Binds signed selection and current operation to parameterized clinic scope predicates.
 * @param actor Verified request actor.
 * @returns SQL replacement values; all never bypasses business clinic assignments.
 */
export function clinicScopeParams(actor: AccessActor) {
  return {
    actorId: actor.id,
    all: false,
    currentClinicId: actor.clinicId ?? null,
    clinicPermission: actor.clinicPermission ?? null
  };
}
/** A clinic must be assigned, selected when specified, and authorized for the actual operation. */
export const CLINIC_ALLOWED_SQL =
  "blue_care_clinic_allowed(:actorId, c.id, CAST(:currentClinicId AS UUID), CAST(:clinicPermission AS TEXT))";
