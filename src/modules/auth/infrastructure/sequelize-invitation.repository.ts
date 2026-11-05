import { recordChange } from "../../audit/infrastructure/record-change";
import { invitationChange } from "../domain/invitation.events";
import { identityChange } from "../../identity/domain/identity.events";
import { requirePatientInvitation } from "../../patients/infrastructure/patient-invitation";
import { linkPatientAccount } from "../../patients/infrastructure/patient-account-link";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
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
   * @param actor Authenticated caller and current effective grants.
   */
  async create(invitation: Invitation, actor?: AccessActor) {
    await this.db.transaction(async transaction => {
      if (actor) await this.authorization.assertAssignable(invitation.props.roles, actor, transaction);
      if (invitation.props.patientId) {
        if (!actor) throw new ForbiddenException("Patient invitation requires an authenticated actor");
        await requirePatientInvitation(this.db, transaction, invitation.props.patientId, invitation.props.email, actor);
      }
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
      await recordChange(
        this.db,
        transaction,
        invitationChange("invitation.created", invitation.id, actor?.id, null, invitation.props)
      );
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
   * @param actor Authenticated caller and current effective grants.
   * @returns Result of the completed operation.
   */
  async rotate(id: string, hash: string, expiresAt: Date, actor?: AccessActor) {
    return this.db.transaction(async transaction => {
      const row = await this.model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (
        !row ||
        !["pending", "expired"].includes(row.status) ||
        (row.lastSendAttemptAt && Date.now() - row.lastSendAttemptAt.getTime() < 60000)
      )
        return false;
      if (actor) await this.authorization.assertAssignable(row.roles, actor, transaction);
      if (row.patientId) {
        if (!actor) throw new ForbiddenException("Patient invitation requires an authenticated actor");
        await requirePatientInvitation(this.db, transaction, row.patientId, row.email, actor);
      }
      const before = row.get({ plain: true });
      await row.update(
        { tokenHash: hash, expiresAt, status: "pending", deliveryStatus: "pending", lastSendAttemptAt: new Date() },
        { transaction }
      );
      await recordChange(
        this.db,
        transaction,
        invitationChange("invitation.resent", id, actor?.id, before, row.get({ plain: true }))
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
      if (!row.invitedBy && (row.invitedByName || row.invitedByEmail))
        throw new ForbiddenException("Inviter no longer exists; issue a new invitation");
      if (row.invitedBy)
        await this.authorization.assertAssignable(
          row.roles,
          await this.authorization.actorFor(row.invitedBy, transaction),
          transaction
        );
      const before = row.get({ plain: true });
      const id = randomUUID();
      if (row.patientId) {
        if (!row.invitedBy) throw new ForbiddenException("Patient invitation requires a current inviter");
        await requirePatientInvitation(
          this.db,
          transaction,
          row.patientId,
          row.email,
          await this.authorization.actorFor(row.invitedBy, transaction)
        );
      }
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
      if (row.patientId) await linkPatientAccount(this.db, transaction, row.patientId, id, id);
      await row.update({ status: "accepted", acceptedAt: new Date(), acceptedUserId: id }, { transaction });
      await recordChange(
        this.db,
        transaction,
        invitationChange("invitation.accepted", row.id, id, before, row.get({ plain: true }))
      );
      await recordChange(
        this.db,
        transaction,
        identityChange("user.activated", id, id, null, {
          id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          name: (row.firstName + " " + row.lastName).trim(),
          enabled: true,
          verified: true,
          roles: row.roles
        })
      );
      return true;
    });
  }
  /**
   * Marks the matching session as revoked.
   * @param id Resource identifier.
   * @param actor Authenticated caller and effective grants.
   * @returns Result of the completed operation.
   */
  async revoke(id: string, actor?: AccessActor) {
    return this.db.transaction(async transaction => {
      const row = await this.model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row || !["pending", "expired"].includes(row.status)) return false;
      const before = row.get({ plain: true });
      await row.update({ status: "revoked" }, { transaction });
      await recordChange(
        this.db,
        transaction,
        invitationChange("invitation.revoked", id, actor?.id, before, row.get({ plain: true }))
      );
      return true;
    });
  }
}
