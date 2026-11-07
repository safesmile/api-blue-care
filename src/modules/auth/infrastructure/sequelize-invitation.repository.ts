import { PermissionCode } from "../../../shared/domain/permission-code";
import { requirePatientScope } from "../../patients/infrastructure/patient-scope";
import { patientChange } from "../../patients/domain/patient.events";
import { recordChange } from "../../audit/infrastructure/record-change";
import { invitationChange } from "../domain/invitation.events";
import { identityChange } from "../../identity/domain/identity.events";
import { requirePatientInvitation } from "../../patients/infrastructure/patient-invitation";
import { linkPatientAccount } from "../../patients/infrastructure/patient-account-link";
import type { AccessActor } from "../../authorization/domain/access-policy";
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { Op, QueryTypes, Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import { Invitation, type InvitationProps, type InvitationKind } from "../domain/invitation.entity";
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
   * Recibe las dependencias de la operación.
   * @param model Dependencia tipada de model.
   * @param db Dependencia tipada de db.
   * @param authorization Dependencia tipada de authorization.
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
   * Separates fixed patient onboarding from arbitrary account role delegation.
   * @param input Persisted invitation properties.
   * @param actor Current verified inviter.
   * @param transaction Current resource transaction.
   */
  private async authorizeAccountRoles(input: InvitationProps, actor: AccessActor, transaction: Transaction) {
    if (input.kind !== "patient") {
      await this.authorization.assertAssignable(input.roles, actor, transaction);
      return;
    }
    if (input.roles.length !== 1 || input.roles[0] !== "customer" || input.staff || input.clinicAssignments?.length)
      throw new BadRequestException("Las invitaciones de pacientes no pueden conceder acceso de personal");
    const current = await this.authorization.actorFor(actor.id, transaction);
    if (
      !current.permissions.includes(PermissionCode.InvitationsCreate) ||
      !current.permissions.includes(PermissionCode.PatientsLink)
    )
      throw new ForbiddenException("El invitador del paciente ya no está autorizado");
    if (input.patientId) {
      const [scope] = await this.db.query<{ allowed: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
         WHERE pc."patientId"=:patientId
         AND blue_care_clinic_allowed(:actorId,c.id,CAST(:selected AS UUID),'invitations:create')
         AND blue_care_clinic_allowed(:actorId,c.id,CAST(:selected AS UUID),'patients:link')) AS allowed`,
        {
          replacements: { actorId: actor.id, patientId: input.patientId, selected: actor.clinicId ?? null },
          transaction,
          type: QueryTypes.SELECT
        }
      );
      if (!scope.allowed)
        throw new ForbiddenException("La invitación del paciente está fuera de su autorización en la clínica actual");
    }
  }
  /**
   * Creates the resource using the supplied input.
   * @param invitation Value required by this operation.
   * @param actor Authenticated caller and current effective grants.
   */
  async create(invitation: Invitation, actor?: AccessActor) {
    await this.db.transaction(async transaction => {
      if (actor) {
        await this.authorizeAccountRoles(invitation.props, actor, transaction);
        await this.authorization.assertClinicAssignable(invitation.props.clinicAssignments ?? [], actor, transaction);
      }
      if (invitation.props.kind === "patient") {
        if (!actor?.clinicId) throw new BadRequestException("Seleccione una clínica antes de invitar a un paciente");
        if (!invitation.props.patientId) {
          const [access] = await this.db.query<{ id: string }>(
            `SELECT c.id FROM clinics c JOIN clinic_staff cs ON cs."clinicId"=c.id
             WHERE c.id=CAST(:clinicId AS UUID) AND c.enabled AND cs."userId"=:actorId
             AND blue_care_clinic_allowed(:actorId,c.id,c.id,'invitations:create')
             AND blue_care_clinic_allowed(:actorId,c.id,c.id,'patients:create')
             AND blue_care_clinic_allowed(:actorId,c.id,c.id,'patients:link') FOR SHARE OF c,cs`,
            { replacements: { actorId: actor.id, clinicId: actor.clinicId }, transaction, type: QueryTypes.SELECT }
          );
          if (!access)
            throw new ForbiddenException("Se requieren permisos para crear y vincular pacientes en la clínica actual");
          const matches = await this.db.query<{ id: string }>(
            `SELECT p.id FROM patients p JOIN patient_clinics pc ON pc."patientId"=p.id WHERE pc."clinicId"=:clinicId
            AND LOWER(p.email)=:email FOR UPDATE OF p`,
            {
              replacements: { clinicId: actor.clinicId, email: invitation.props.email },
              transaction,
              type: QueryTypes.SELECT
            }
          );
          if (matches.length > 1)
            throw new ConflictException("Seleccione la ficha del paciente existente antes de invitar a este contacto");
          if (matches.length) invitation.props.patientId = matches[0].id;
          else {
            const id = randomUUID();
            await this.db.query(
              `INSERT INTO patients(id,"firstName","lastName",email,enabled,"createdAt","updatedAt")
              VALUES (:id,:firstName,:lastName,:email,true,NOW(),NOW());
              INSERT INTO patient_clinics("patientId","clinicId","createdAt") VALUES (:id,:clinicId,NOW())`,
              {
                replacements: {
                  id,
                  firstName: invitation.props.firstName,
                  lastName: invitation.props.lastName,
                  email: invitation.props.email,
                  clinicId: actor.clinicId
                },
                transaction
              }
            );
            invitation.props.patientId = id;
            await recordChange(
              this.db,
              transaction,
              patientChange("patient.created", id, actor.id, null, {
                id,
                firstName: invitation.props.firstName,
                lastName: invitation.props.lastName,
                email: invitation.props.email,
                clinicId: actor.clinicId
              })
            );
          }
        }
      }
      if (invitation.props.patientId) {
        if (!actor) throw new ForbiddenException("La invitación del paciente requiere un usuario autenticado");
        await requirePatientInvitation(this.db, transaction, invitation.props.patientId, invitation.props.email, actor);
      }
      await this.db.query("SELECT pg_advisory_xact_lock(hashtext(:email))", {
        replacements: { email: invitation.props.email },
        transaction
      });
      if (await UserModel.findOne({ where: { email: invitation.props.email }, transaction }))
        throw new ConflictException("El correo electrónico ya está registrado");
      const pending = await this.model.findOne({
        where: { email: invitation.props.email, status: "pending", expiresAt: { [Op.gt]: new Date() } },
        transaction
      });
      if (pending) throw new ConflictException("Ya existe una invitación pendiente; utilice la opción de reenviar");
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
   * @param actor Authenticated caller and current role grants.
   * @returns Result of the completed operation.
   */
  async list(page: Pagination & { kind?: InvitationKind }, actor?: AccessActor) {
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const global =
        !actor ||
        ((actor.globalPermissions ?? actor.permissions).includes(PermissionCode.InvitationsList) &&
          (actor.globalPermissions ?? actor.permissions).includes(PermissionCode.ClinicsAll));
      const where = `WHERE (:kind IS NULL OR i.kind=:kind) AND (:global OR (i."invitedBy"=:actorId AND i."patientId" IS NULL AND jsonb_array_length(i."clinicAssignments")=0)
        OR (jsonb_array_length(i."clinicAssignments")>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(i."clinicAssignments") a
        WHERE NOT blue_care_clinic_allowed(:actorId,CAST(a->>'clinicId' AS UUID),CAST(:selected AS UUID),'invitations:list')))
        OR (i."patientId" IS NOT NULL AND EXISTS(SELECT 1 FROM patient_clinics pc JOIN clinics c ON c.id=pc."clinicId" AND c.enabled
        WHERE pc."patientId"=i."patientId" AND blue_care_clinic_allowed(:actorId,c.id,CAST(:selected AS UUID),'invitations:list'))))`;
      const replacements = {
        ...page,
        kind: page.kind ?? null,
        global,
        actorId: actor?.id ?? null,
        selected: actor?.clinicId ?? null
      };
      const ids = await this.db.query<{ id: string }>(
        "SELECT i.id FROM invitations i " + where + ' ORDER BY i."createdAt" DESC,i.id LIMIT :limit OFFSET :offset',
        { replacements, transaction, type: QueryTypes.SELECT }
      );
      const [count] = await this.db.query<{ total: number }>("SELECT COUNT(*)::int total FROM invitations i " + where, {
        replacements,
        transaction,
        type: QueryTypes.SELECT
      });
      const rows = ids.length
        ? await this.model.findAll({
            where: { id: { [Op.in]: ids.map(row => row.id) } },
            order: [
              ["createdAt", "DESC"],
              ["id", "ASC"]
            ],
            transaction
          })
        : [];
      return { items: rows.map(row => this.map(row)), total: count.total };
    });
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
      if (actor) {
        await this.authorizeAccountRoles(row.get({ plain: true }) as InvitationProps, actor, transaction);
        await this.authorization.assertClinicAssignable(row.clinicAssignments, actor, transaction);
        if (
          !row.clinicAssignments.length &&
          !row.patientId &&
          row.invitedBy !== actor.id &&
          !(actor.globalPermissions ?? actor.permissions).includes(PermissionCode.InvitationsResend)
        )
          throw new ForbiddenException("La invitación está fuera de su ámbito de administración");
      }
      if (row.patientId) {
        if (!actor) throw new ForbiddenException("La invitación del paciente requiere un usuario autenticado");
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
        throw new ConflictException("El correo electrónico ya está registrado");
      if (!row.invitedBy && (row.invitedByName || row.invitedByEmail))
        throw new ForbiddenException("El invitador ya no existe; genere una nueva invitación");
      if (row.invitedBy)
        await this.authorizeAccountRoles(
          row.get({ plain: true }) as InvitationProps,
          await this.authorization.actorFor(row.invitedBy, transaction),
          transaction
        );
      if (row.clinicAssignments.length) {
        if (!row.invitedBy) throw new ForbiddenException("La invitación del colaborador requiere al invitador vigente");
        await this.authorization.assertClinicAssignable(
          row.clinicAssignments,
          await this.authorization.actorFor(row.invitedBy, transaction),
          transaction
        );
      }
      const before = row.get({ plain: true });
      const id = randomUUID();
      if (row.patientId) {
        if (!row.invitedBy) throw new ForbiddenException("La invitación del paciente requiere al invitador vigente");
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
      if (row.staff)
        await this.db.query(
          'INSERT INTO staff_profiles("userId","createdAt") VALUES (:id,NOW()) ON CONFLICT DO NOTHING',
          { replacements: { id }, transaction }
        );
      if (row.clinicAssignments.length) {
        const inviter = await this.authorization.actorFor(row.invitedBy!, transaction);
        for (const assignment of row.clinicAssignments)
          await this.authorization.assignClinic(id, assignment, inviter, transaction);
      }
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
      if (actor) {
        await this.authorization.assertClinicAssignable(row.clinicAssignments, actor, transaction);
        if (
          !row.clinicAssignments.length &&
          row.invitedBy !== actor.id &&
          !(actor.globalPermissions ?? actor.permissions).includes(PermissionCode.InvitationsRevoke)
        )
          throw new ForbiddenException("La invitación está fuera de su ámbito de administración");
      }
      if (actor && row.patientId) {
        const global = await this.authorization.permissionsFor(
          await this.authorization.rolesFor(actor.id, transaction),
          transaction
        );
        if (!(global.includes(PermissionCode.InvitationsRevoke) && global.includes(PermissionCode.ClinicsAll)))
          await requirePatientScope(this.db, transaction, row.patientId, {
            ...actor,
            clinicPermission: PermissionCode.InvitationsRevoke
          });
      }
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
