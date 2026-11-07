import { MembershipsRules } from "../../../modules/memberships/application/membershipsRules.service";
import { MembershipRepository } from "../../../modules/memberships/domain/membership.repository";
import { MembershipBilling, MembershipGateway } from "../../../modules/memberships/domain/membership-billing";
import { PatientRepository } from "../../../modules/patients/domain/patient.repository";
import { CrudMembershipsUseCase } from "../../../modules/memberships/application/crudMemberships.usecase";
import { CreateOwnMembershipUseCase } from "../../../modules/memberships/application/createOwnMembership.usecase";
import { CancelMembershipUseCase } from "../../../modules/memberships/application/cancelMembership.usecase";
import { SuspendMembershipUseCase } from "../../../modules/memberships/application/suspendMembership.usecase";
import { PeriodsMembershipUseCase } from "../../../modules/memberships/application/periodsMembership.usecase";
import { CheckoutMembershipUseCase } from "../../../modules/memberships/application/checkoutMembership.usecase";
import { ReceiveMembershipUseCase } from "../../../modules/memberships/application/receiveMembership.usecase";
import { DrainMembershipUseCase } from "../../../modules/memberships/application/drainMembership.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class MembershipsUseCase {
  private readonly CrudMembershipsUseCase: CrudMembershipsUseCase;
  private readonly CreateOwnMembershipUseCase: CreateOwnMembershipUseCase;
  private readonly CancelMembershipUseCase: CancelMembershipUseCase;
  private readonly SuspendMembershipUseCase: SuspendMembershipUseCase;
  private readonly PeriodsMembershipUseCase: PeriodsMembershipUseCase;
  private readonly CheckoutMembershipUseCase: CheckoutMembershipUseCase;
  private readonly ReceiveMembershipUseCase: ReceiveMembershipUseCase;
  private readonly DrainMembershipUseCase: DrainMembershipUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param memberships Dependencia tipada de memberships.
   * @param patients Dependencia tipada de patients.
   * @param billing Dependencia tipada de billing.
   * @param gateway Dependencia tipada de gateway.
   */
  constructor(
    memberships: MembershipRepository,
    patients: PatientRepository,
    billing: MembershipBilling,
    gateway: MembershipGateway
  ) {
    this.CrudMembershipsUseCase = new CrudMembershipsUseCase(memberships, new MembershipsRules());
    this.CreateOwnMembershipUseCase = new CreateOwnMembershipUseCase(memberships, patients, new MembershipsRules());
    this.CancelMembershipUseCase = new CancelMembershipUseCase(memberships);
    this.SuspendMembershipUseCase = new SuspendMembershipUseCase(memberships);
    this.PeriodsMembershipUseCase = new PeriodsMembershipUseCase(memberships);
    this.CheckoutMembershipUseCase = new CheckoutMembershipUseCase(
      billing,
      new CrudMembershipsUseCase(memberships, new MembershipsRules())
    );
    this.ReceiveMembershipUseCase = new ReceiveMembershipUseCase(billing, gateway);
    this.DrainMembershipUseCase = new DrainMembershipUseCase(billing);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudMembershipsUseCase["create"]>): ReturnType<CrudMembershipsUseCase["create"]> {
    return this.CrudMembershipsUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  createOwn(
    ...args: Parameters<CreateOwnMembershipUseCase["execute"]>
  ): ReturnType<CreateOwnMembershipUseCase["execute"]> {
    return this.CreateOwnMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudMembershipsUseCase["read"]>): ReturnType<CrudMembershipsUseCase["read"]> {
    return this.CrudMembershipsUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudMembershipsUseCase["list"]>): ReturnType<CrudMembershipsUseCase["list"]> {
    return this.CrudMembershipsUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  cancel(...args: Parameters<CancelMembershipUseCase["execute"]>): ReturnType<CancelMembershipUseCase["execute"]> {
    return this.CancelMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  suspend(...args: Parameters<SuspendMembershipUseCase["execute"]>): ReturnType<SuspendMembershipUseCase["execute"]> {
    return this.SuspendMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  periods(...args: Parameters<PeriodsMembershipUseCase["execute"]>): ReturnType<PeriodsMembershipUseCase["execute"]> {
    return this.PeriodsMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  checkout(
    ...args: Parameters<CheckoutMembershipUseCase["execute"]>
  ): ReturnType<CheckoutMembershipUseCase["execute"]> {
    return this.CheckoutMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  receive(...args: Parameters<ReceiveMembershipUseCase["execute"]>): ReturnType<ReceiveMembershipUseCase["execute"]> {
    return this.ReceiveMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  drain(...args: Parameters<DrainMembershipUseCase["execute"]>): ReturnType<DrainMembershipUseCase["execute"]> {
    return this.DrainMembershipUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: CrudMembershipsUseCase, useValue: value },
      { provide: CreateOwnMembershipUseCase, useValue: { execute: value.createOwn } },
      { provide: CancelMembershipUseCase, useValue: { execute: value.cancel } },
      { provide: SuspendMembershipUseCase, useValue: { execute: value.suspend } },
      { provide: PeriodsMembershipUseCase, useValue: { execute: value.periods } },
      { provide: CheckoutMembershipUseCase, useValue: { execute: value.checkout } },
      { provide: ReceiveMembershipUseCase, useValue: { execute: value.receive } },
      { provide: DrainMembershipUseCase, useValue: { execute: value.drain } }
    ];
  }
  /**
   *
   * @param app Entrada de la operación.
   * @param app.get Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static resolve(app: { get(token: any): any }) {
    return {
      create: (...args: Parameters<CrudMembershipsUseCase["create"]>) =>
        app.get(CrudMembershipsUseCase).create(...args),
      createOwn: (...args: Parameters<CreateOwnMembershipUseCase["execute"]>) =>
        app.get(CreateOwnMembershipUseCase).execute(...args),
      read: (...args: Parameters<CrudMembershipsUseCase["read"]>) => app.get(CrudMembershipsUseCase).read(...args),
      list: (...args: Parameters<CrudMembershipsUseCase["list"]>) => app.get(CrudMembershipsUseCase).list(...args),
      cancel: (...args: Parameters<CancelMembershipUseCase["execute"]>) =>
        app.get(CancelMembershipUseCase).execute(...args),
      suspend: (...args: Parameters<SuspendMembershipUseCase["execute"]>) =>
        app.get(SuspendMembershipUseCase).execute(...args),
      periods: (...args: Parameters<PeriodsMembershipUseCase["execute"]>) =>
        app.get(PeriodsMembershipUseCase).execute(...args),
      checkout: (...args: Parameters<CheckoutMembershipUseCase["execute"]>) =>
        app.get(CheckoutMembershipUseCase).execute(...args),
      receive: (...args: Parameters<ReceiveMembershipUseCase["execute"]>) =>
        app.get(ReceiveMembershipUseCase).execute(...args),
      drain: (...args: Parameters<DrainMembershipUseCase["execute"]>) =>
        app.get(DrainMembershipUseCase).execute(...args)
    };
  }
}
