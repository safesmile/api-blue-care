import { PermissionCode } from "../../../shared/domain/permission-code";
import { PERSONAL_PERMISSION_CODES } from "../domain/access-policy";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { QueryTypes, Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import {
  ClinicContextRepository,
  type ContextUser,
  type SessionMode,
  type AccessibleClinic
} from "../domain/clinic-context.repository";
import type { UserView } from "../../identity/domain/user";
import { AuthorizationStore } from "./authorization.store";
/** Computes current roles per assigned active clinic and the signed selection. */
@Injectable()
export class SqlClinicContextRepository extends ClinicContextRepository {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   * @param authorization Dependencia tipada de authorization.
   */
  constructor(
    private readonly db: Sequelize,
    private readonly authorization: AuthorizationStore
  ) {
    super();
  }
  /**
   *
   * @param user Verified identity view.
   * @param clinicId Selected clinic, or null for all authorized assignments.
   * @param strict Whether an unavailable clinic selection must be rejected.
   * @param mode Patient or staff portal for this session.
   * @returns The authorized result or completion of the operation.
   */
  async resolve(user: UserView, clinicId: string | null, strict: boolean, mode?: SessionMode): Promise<ContextUser> {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const globalRoles = await this.authorization.rolesFor(user.id, transaction),
        globalPermissions = await this.authorization.permissionsFor(globalRoles, transaction);
      const personal = (code: string) => PERSONAL_PERMISSION_CODES.includes(code);
      const [profiles] = await this.db.query<{ staff: boolean; patient: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM staff_profiles WHERE "userId"=:id) AS staff,
        EXISTS(SELECT 1 FROM patients WHERE "userId"=:id) AS patient`,
        { replacements: { id: user.id }, transaction, type: QueryTypes.SELECT }
      );
      const staff = profiles.staff || globalRoles.includes("staff") || globalPermissions.some(code => !personal(code));
      const patient = profiles.patient || globalPermissions.includes(PermissionCode.PatientsSelf);
      const availableModes: SessionMode[] = [
        ...(patient ? ["patient" as const] : []),
        ...(staff ? ["staff" as const] : [])
      ];
      // An identity without business grants may still manage its own security.
      if (!availableModes.length) availableModes.push("patient");
      const selectedMode = mode ?? (staff ? "staff" : "patient");
      if (!availableModes.includes(selectedMode)) throw new ForbiddenException("El tipo de sesión no está disponible");
      if (selectedMode === "patient") {
        if (clinicId) throw new ForbiddenException("Las sesiones de pacientes no pueden seleccionar una clínica");
        const permissions = globalPermissions.filter(personal);
        return {
          ...user,
          roles: globalRoles,
          permissions,
          mode: selectedMode,
          globalRoles,
          globalPermissions: permissions,
          clinics: []
        };
      }
      const clinics = await this.db.query<AccessibleClinic>(
        `SELECT c.id,c.name,
        COALESCE((SELECT ARRAY_AGG(DISTINCT r.name
 ORDER BY r.name)
 FROM user_roles ur
 JOIN roles r
 ON r.id=ur."roleId"
 WHERE ur."userId"=:id
 AND ur."clinicId"=c.id),'{}') AS roles,
        COALESCE((SELECT ARRAY_AGG(DISTINCT rp."permissionCode"
 ORDER BY rp."permissionCode")
 FROM user_roles ur
 JOIN role_permissions rp
 ON rp."roleId"=ur."roleId"
 WHERE ur."userId"=:id
 AND (ur."clinicId"=c.id
 OR ur."clinicId" IS NULL)),'{}') AS permissions
       
 FROM clinics c
 JOIN clinic_staff s
 ON s."clinicId"=c.id
 WHERE s."userId"=:id
 AND c.enabled
 ORDER BY c.name,c.id`,
        { replacements: { id: user.id }, transaction, type: QueryTypes.SELECT }
      );
      if (strict && clinicId && !clinics.some(clinic => clinic.id === clinicId))
        throw new ForbiddenException("La clínica no está asignada o está inactiva");
      const selected = clinicId ? clinics.filter(clinic => clinic.id === clinicId) : clinics;
      const clinical = (code: string) =>
        /^(patients:(?!self)|memberships:(?!self)|benefits:(balances|consume|reverse|history|family-manage)|prevention:(?!self|configure)|dashboard:)/.test(
          code
        );
      const permissions = [
        ...new Set([
          ...globalPermissions.filter(code => !clinical(code) || selected.length > 0),
          ...selected.flatMap(clinic =>
            clinic.permissions.filter(
              code =>
                clinical(code) ||
                (
                  [
                    PermissionCode.ClinicsList,
                    PermissionCode.ClinicsRead,
                    PermissionCode.ClinicsUpdate,
                    PermissionCode.ClinicsStaffList,
                    PermissionCode.ClinicsStaffManage
                  ] as readonly string[]
                ).includes(code) ||
                code.startsWith("invitations:") ||
                code.startsWith("audit:") ||
                (
                  [
                    PermissionCode.RolesAssign,
                    PermissionCode.RolesList,
                    PermissionCode.RolesRead,
                    PermissionCode.PermissionsList
                  ] as readonly string[]
                ).includes(code)
            )
          )
        ])
      ].sort();
      return {
        ...user,
        roles: [...new Set([...globalRoles, ...selected.flatMap(clinic => clinic.roles)])].sort(),
        permissions,
        clinicId,
        mode: selectedMode,
        globalRoles,
        globalPermissions,
        clinics
      };
    });
  }
}
