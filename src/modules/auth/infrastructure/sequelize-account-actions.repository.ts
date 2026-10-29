import { ROLE_NAMES } from "../../../permissions";
import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { UniqueConstraintError } from "sequelize";
import { AuthorizationStore } from "../../authorization/infrastructure/authorization.store";
import { AccountActionsRepository, type AccountAction } from "../domain/account-actions.repository";
import { AccountActionModel } from "./account-action.model";
import { UserModel } from "../../identity/infrastructure/user.model";
import { SessionModel } from "./session.model";
/**
 * Redeems account action tokens with transactional user changes.
 */
@Injectable()
export class SequelizeAccountActionsRepository extends AccountActionsRepository {
  /**
   * Receives the dependencies required by this component.
   * @param actions Account action repository or application service.
   * @param db Database connection used to coordinate transactions.
   * @param authorization Resolves current role memberships.
   */
  constructor(
    @InjectModel(AccountActionModel) private readonly actions: typeof AccountActionModel,
    private readonly db: Sequelize,
    private readonly authorization: AuthorizationStore
  ) {
    super();
  }
  /**
   * Persists the account action token hash.
   * @param action Account action data to persist.
   */
  async save(action: AccountAction) {
    await this.actions.create({ ...action });
  }
  /**
   * Consumes a one-use token to create an account or replace a password.
   * @param hash Stored token or password digest.
   * @param kind Account action to authorize.
   * @param passwordHash Previously computed password hash.
   * @returns Result of the completed operation.
   */
  async redeem(hash: string, kind: "reset" | "activate", passwordHash: string) {
    return this.db.transaction(async transaction => {
      const hint = await this.actions.findByPk(hash, { transaction });
      if (!hint || hint.kind !== kind || hint.expiresAt.getTime() <= Date.now()) return false;
      const user = await UserModel.findOne({
        where: { email: hint.email },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const action = await this.actions.findByPk(hash, { transaction, lock: transaction.LOCK.UPDATE });
      if (
        !action ||
        action.kind !== kind ||
        action.expiresAt.getTime() <= Date.now() ||
        !user?.enabled ||
        (action.userId && action.userId !== user.id)
      )
        return false;
      if (kind === "activate") {
        if (
          user.verified ||
          !(await this.authorization.rolesFor(user.id, transaction)).some(role =>
            ROLE_NAMES.some(allowed => allowed === role)
          )
        )
          return false;
      } else if (!user.verified) return false;
      await user.update({ passwordHash, verified: true }, { transaction });
      await SessionModel.update({ revoked: true }, { where: { userId: user.id }, transaction });
      await this.actions.destroy({ where: { email: user.email }, transaction });
      return true;
    });
  }
  /**
   * Changes the authenticated account credentials and revokes its sessions.
   * @param userId Identifier of the session owner.
   * @param expectedHash Previously verified credential hash used for a concurrent-update check.
   * @param passwordHash Previously computed password hash.
   * @returns Result of the completed operation.
   */
  async changePassword(userId: string, expectedHash: string, passwordHash: string) {
    return this.db.transaction(async transaction => {
      const user = await UserModel.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user?.enabled || !user.verified || user.passwordHash !== expectedHash) return false;
      await user.update({ passwordHash }, { transaction });
      await SessionModel.update({ revoked: true }, { where: { userId }, transaction });
      await this.actions.destroy({ where: { email: user.email }, transaction });
      return true;
    });
  }
  /**
   * Consumes new-contact verification before changing the stored email.
   * @param hash Stored token or password digest.
   * @returns Result of the completed operation.
   */
  async confirmEmail(hash: string) {
    try {
      return await this.db.transaction(async transaction => {
        const hint = await this.actions.findByPk(hash, { transaction });
        if (!hint || hint.kind !== "email-change" || !hint.userId) return false;
        const user = await UserModel.findByPk(hint.userId, { transaction, lock: transaction.LOCK.UPDATE });
        const action = await this.actions.findByPk(hash, { transaction, lock: transaction.LOCK.UPDATE });
        if (
          !action ||
          action.kind !== "email-change" ||
          !action.targetEmail ||
          action.expiresAt.getTime() <= Date.now() ||
          !user?.enabled ||
          !user.verified ||
          user.email !== action.email
        )
          return false;
        await user.update({ email: action.targetEmail, verified: true }, { transaction });
        await SessionModel.update({ revoked: true }, { where: { userId: user.id }, transaction });
        await this.actions.destroy({ where: { email: action.email }, transaction });
        return true;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new ConflictException("Email already registered");
      throw error;
    }
  }
}
