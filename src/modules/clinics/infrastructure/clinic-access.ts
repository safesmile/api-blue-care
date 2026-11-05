import { ForbiddenException, Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import type { AccessActor } from "../../authorization/domain/access-policy";
/** Resolves current assignments on every operation, including transactional writes. */
@Injectable()
export class ClinicAccess {
  /**
   *
   * @param db PostgreSQL connection.
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
    if (!clinic) throw new NotFoundException("Clinic not found");
    if (!actor.permissions.includes("clinics:all")) {
      const [assignment] = await this.db.query<{ userId: string }>(
        'SELECT "userId" FROM clinic_staff WHERE "clinicId"=:id AND "userId"=:userId' +
          (transaction ? " FOR SHARE" : ""),
        { replacements: { id, userId: actor.id }, type: QueryTypes.SELECT, transaction }
      );
      if (!assignment) throw new ForbiddenException("Clinic outside assigned scope");
    }
    if (active && !clinic.enabled) throw new ConflictException("Clinic is inactive");
  }
}
