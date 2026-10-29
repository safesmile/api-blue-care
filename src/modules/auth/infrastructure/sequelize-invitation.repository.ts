import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { Op } from "sequelize";
import { randomUUID } from "node:crypto";
import { Invitation, type InvitationProps } from "../domain/invitation.entity";
import { InvitationRepository } from "../domain/invitation.repository";
import { InvitationModel } from "./invitation.model";
import { UserModel } from "../../identity/infrastructure/user.model";
import { AuthorizationStore } from "../../authorization/infrastructure/authorization.store";
import type { Pagination } from "../../../shared/domain/crud.repository";
/**
 * Persists invitation transitions and identity creation atomically.
 */
@Injectable()
export class SequelizeInvitationRepository extends InvitationRepository {
  /**
   * Receives the dependencies required by this component.
   * @param model Sequelize model used for persistence.
   * @param db Database connection used to coordinate transactions.
   * @param authorization Resolves current role memberships.
   */
  constructor(
    @InjectModel(InvitationModel) private readonly model: typeof InvitationModel,
    private readonly db: Sequelize,
    private readonly authorization: AuthorizationStore
  ) {
    super();
  }
  /**
   * Converts a persistence model to a domain entity.
   * @param row Persistence row to map.
   * @returns Result of the completed operation.
   */
  private map(row: InvitationModel) {
    return new Invitation(row.get({ plain: true }) as InvitationProps, row.id);
  }
  /**
   * Creates the resource using the supplied input.
   * @param invitation Value required by this operation.
   */
  async create(invitation: Invitation) {
    await this.db.transaction(async transaction => {
      await this.db.query("SELECT pg_advisory_xact_lock(hashtext(:email))", {
        replacements: { email: invitation.props.email },
        transaction
      });
      if (await UserModel.findOne({ where: { email: invitation.props.email }, transaction }))
        throw new ConflictException("Email already registered");
      const pending = await this.model.findOne({
        where: { email: invitation.props.email, status: "pending", expiresAt: { [Op.gt]: new Date() } },
        transaction
      });
      if (pending) throw new ConflictException("A pending invitation already exists; resend it instead");
      await this.model.update(
        { status: "expired" },
        { where: { email: invitation.props.email, status: "pending" }, transaction }
      );
      await this.model.create({ id: invitation.id, ...invitation.props }, { transaction });
    });
  }
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async read(id: string) {
    const row = await this.model.findByPk(id);
    return row ? this.map(row) : null;
  }
  /**
   * Applies the findByToken operation.
   * @param hash Stored token or password digest.
   * @returns Result of the completed operation.
   */
  async findByToken(hash: string) {
    const row = await this.model.findOne({ where: { tokenHash: hash } });
    return row ? this.map(row) : null;
  }
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination) {
    const result = await this.model.findAndCountAll({
      ...page,
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"]
      ]
    });
    return { items: result.rows.map(row => this.map(row)), total: result.count };
  }
  /**
   * Consumes the current session and persists its successor atomically.
   * @param id Resource identifier.
   * @param hash Stored token or password digest.
   * @param expiresAt Value required by this operation.
   * @returns Result of the completed operation.
   */
  async rotate(id: string, hash: string, expiresAt: Date) {
    return this.db.transaction(async transaction => {
      const row = await this.model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (
        !row ||
        !["pending", "expired"].includes(row.status) ||
        (row.lastSendAttemptAt && Date.now() - row.lastSendAttemptAt.getTime() < 60000)
      )
        return false;
      await row.update(
        { tokenHash: hash, expiresAt, status: "pending", deliveryStatus: "pending", lastSendAttemptAt: new Date() },
        { transaction }
      );
      return true;
    });
  }
  /**
   * Records the result of a specific token delivery attempt.
   * @param id Resource identifier.
   * @param hash Stored token or password digest.
   * @param success Whether SMTP accepted the message.
   */
  async delivery(id: string, hash: string, success: boolean) {
    await this.model.update(
      { deliveryStatus: success ? "sent" : "failed", ...(success ? { lastSentAt: new Date() } : {}) },
      { where: { id, tokenHash: hash } }
    );
  }
  /**
   * Consumes a valid invitation and establishes verified credentials.
   * @param hash Stored token or password digest.
   * @param passwordHash Previously computed password hash.
   * @returns Result of the completed operation.
   */
  async accept(hash: string, passwordHash: string) {
    return this.db.transaction(async transaction => {
      const row = await this.model.findOne({ where: { tokenHash: hash }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row || row.status !== "pending" || row.expiresAt.getTime() <= Date.now()) return false;
      await this.db.query("SELECT pg_advisory_xact_lock(hashtext(:email))", {
        replacements: { email: row.email },
        transaction
      });
      if (await UserModel.findOne({ where: { email: row.email }, transaction }))
        throw new ConflictException("Email already registered");
      const id = randomUUID();
      await UserModel.create(
        {
          id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          name: (row.firstName + " " + row.lastName).trim(),
          passwordHash,
          enabled: true,
          verified: true
        },
        { transaction }
      );
      await this.authorization.setRoles(id, row.roles, transaction);
      await row.update({ status: "accepted", acceptedAt: new Date(), acceptedUserId: id }, { transaction });
      return true;
    });
  }
  /**
   * Marks the matching session as revoked.
   * @param id Resource identifier.
   * @returns Result of the completed operation.
   */
  async revoke(id: string) {
    const [count] = await this.model.update({ status: "revoked" }, { where: { id, status: ["pending", "expired"] } });
    return count > 0;
  }
}
