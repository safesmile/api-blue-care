import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { SessionRepository, type Session } from "../domain/session.repository";
import { SessionModel } from "./session.model";
/**
 * Persists sessions and rotates refresh tokens atomically.
 */
@Injectable()
export class SequelizeSessionRepository extends SessionRepository {
  /**
   * Receives the dependencies required by this component.
   * @param model Sequelize model used for persistence.
   * @param db Database connection used to coordinate transactions.
   */
  constructor(
    @InjectModel(SessionModel) private readonly model: typeof SessionModel,
    private readonly db: Sequelize
  ) {
    super();
  }
  /**
   * Creates the resource using the supplied input.
   * @param session Session data to persist.
   */
  async create(session: Session) {
    await this.model.create({ ...session });
  }
  /**
   * Consumes the current session and persists its successor atomically.
   * @param hash Stored token or password digest.
   * @param replacement Callback that builds the successor while the current row is locked.
   * @returns Result of the completed operation.
   */
  async rotate(hash: string, replacement: (current: Session) => Promise<Session | null>) {
    return this.db.transaction(async transaction => {
      const row = await this.model.findOne({
        where: { tokenHash: hash },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!row || row.revoked || row.expiresAt.getTime() <= Date.now() || row.absoluteExpiresAt.getTime() <= Date.now())
        return false;
      const next = await replacement(row.get({ plain: true }) as Session);
      if (!next) return false;
      await row.update({ revoked: true }, { transaction });
      await this.model.create({ ...next }, { transaction });
      return true;
    });
  }
  /**
   * Checks session ownership, revocation and expiration.
   * @param id Resource identifier.
   * @param userId Identifier of the session owner.
   * @returns Whether the required checks passed.
   */
  async isActive(id: string, userId: string) {
    const row = await this.model.findOne({
      where: { id, userId, revoked: false }
    });
    return !!row && row.expiresAt.getTime() > Date.now() && row.absoluteExpiresAt.getTime() > Date.now();
  }
  /**
   * Marks the matching session as revoked.
   * @param hash Stored token or password digest.
   */
  async revoke(hash: string) {
    await this.model.update({ revoked: true }, { where: { tokenHash: hash } });
  }
}
