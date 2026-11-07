import { clinicScopeParams } from "./clinic-scope";
import { ForbiddenException, Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import type { AccessActor } from "../../authorization/domain/access-policy";
/** Resolves current assignments on every operation, including transactional writes. */
@Injectable()
export class ClinicAccess {
  /**
   * Recibe las dependencias de la operación.
   * @param db Dependencia tipada de db.
   */
  constructor(private readonly db: Sequelize) {}
  /**
   * Requires explicit operation authority or clinic assignment.
   * @param id Resource identifier.
   * @param actor Authenticated identity and current permissions.
   * @param transaction Transaction containing the resource mutation.
   * @param active Whether the clinic must be enabled.
   */
  async require(id: string, actor: AccessActor, transaction?: Transaction, active = false) {
    const [clinic] = await this.db.query<{ enabled: boolean }>(
      "SELECT enabled FROM clinics WHERE id=:id" + (transaction ? " FOR SHARE" : ""),
      { replacements: { id }, type: QueryTypes.SELECT, transaction }
    );
    if (!clinic) throw new NotFoundException("No se encontró la clínica");
    const [assignment] = await this.db.query<{ userId: string }>(
      `SELECT s."userId"
 FROM clinic_staff s
 WHERE s."clinicId"=:id
 AND s."userId"=:actorId
 AND blue_care_clinic_allowed(:actorId,s."clinicId",CAST(:currentClinicId AS UUID),CAST(:clinicPermission AS TEXT))` +
        (transaction ? " FOR SHARE" : ""),
      { replacements: { id, ...clinicScopeParams(actor) }, type: QueryTypes.SELECT, transaction }
    );
    if (!assignment)
      throw new ForbiddenException("La clínica está fuera de la selección o de las asignaciones autorizadas");
    if (transaction)
      await this.db.query(
        `SELECT ur.id
 FROM user_roles ur
 JOIN roles r
 ON r.id=ur."roleId"
 JOIN role_permissions rp
 ON rp."roleId"=r.id
 WHERE ur."userId"=:actorId
 AND (ur."clinicId" IS NULL
 OR ur."clinicId"=:id)
 AND (CAST(:clinicPermission AS TEXT) IS NULL
 OR rp."permissionCode"=:clinicPermission) FOR SHARE OF ur,r,rp`,
        { replacements: { id, ...clinicScopeParams(actor) }, transaction, type: QueryTypes.SELECT }
      );

    if (active && !clinic.enabled) throw new ConflictException("La clínica está inactiva");
  }
}
