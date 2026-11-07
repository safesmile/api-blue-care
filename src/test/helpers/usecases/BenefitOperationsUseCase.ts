import { BenefitOperationsRules } from "../../../modules/benefits/application/benefitOperationsRules.service";
import { BenefitOperationsRepository } from "../../../modules/benefits/domain/benefit-operations.repository";
import { FamilyBenefitUseCase } from "../../../modules/benefits/application/familyBenefit.usecase";
import { AddBeneficiaryBenefitUseCase } from "../../../modules/benefits/application/addBeneficiaryBenefit.usecase";
import { ReplaceBeneficiaryBenefitUseCase } from "../../../modules/benefits/application/replaceBeneficiaryBenefit.usecase";
import { BalancesBenefitUseCase } from "../../../modules/benefits/application/balancesBenefit.usecase";
import { IssueTicketBenefitUseCase } from "../../../modules/benefits/application/issueTicketBenefit.usecase";
import { ConsumeBenefitUseCase } from "../../../modules/benefits/application/consumeBenefit.usecase";
import { ConsumeTicketBenefitUseCase } from "../../../modules/benefits/application/consumeTicketBenefit.usecase";
import { ReverseBenefitUseCase } from "../../../modules/benefits/application/reverseBenefit.usecase";
import { HistoryBenefitUseCase } from "../../../modules/benefits/application/historyBenefit.usecase";
import { ClinicHistoryBenefitUseCase } from "../../../modules/benefits/application/clinicHistoryBenefit.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class BenefitOperationsUseCase {
  private readonly FamilyBenefitUseCase: FamilyBenefitUseCase;
  private readonly AddBeneficiaryBenefitUseCase: AddBeneficiaryBenefitUseCase;
  private readonly ReplaceBeneficiaryBenefitUseCase: ReplaceBeneficiaryBenefitUseCase;
  private readonly BalancesBenefitUseCase: BalancesBenefitUseCase;
  private readonly IssueTicketBenefitUseCase: IssueTicketBenefitUseCase;
  private readonly ConsumeBenefitUseCase: ConsumeBenefitUseCase;
  private readonly ConsumeTicketBenefitUseCase: ConsumeTicketBenefitUseCase;
  private readonly ReverseBenefitUseCase: ReverseBenefitUseCase;
  private readonly HistoryBenefitUseCase: HistoryBenefitUseCase;
  private readonly ClinicHistoryBenefitUseCase: ClinicHistoryBenefitUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param operations Dependencia tipada de operations.
   */
  constructor(operations: BenefitOperationsRepository) {
    this.FamilyBenefitUseCase = new FamilyBenefitUseCase(operations);
    this.AddBeneficiaryBenefitUseCase = new AddBeneficiaryBenefitUseCase(operations, new BenefitOperationsRules());
    this.ReplaceBeneficiaryBenefitUseCase = new ReplaceBeneficiaryBenefitUseCase(
      operations,
      new BenefitOperationsRules()
    );
    this.BalancesBenefitUseCase = new BalancesBenefitUseCase(operations);
    this.IssueTicketBenefitUseCase = new IssueTicketBenefitUseCase(operations, new BenefitOperationsRules());
    this.ConsumeBenefitUseCase = new ConsumeBenefitUseCase(operations, new BenefitOperationsRules());
    this.ConsumeTicketBenefitUseCase = new ConsumeTicketBenefitUseCase(operations);
    this.ReverseBenefitUseCase = new ReverseBenefitUseCase(operations);
    this.HistoryBenefitUseCase = new HistoryBenefitUseCase(operations);
    this.ClinicHistoryBenefitUseCase = new ClinicHistoryBenefitUseCase(operations);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  family(...args: Parameters<FamilyBenefitUseCase["execute"]>): ReturnType<FamilyBenefitUseCase["execute"]> {
    return this.FamilyBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  addBeneficiary(
    ...args: Parameters<AddBeneficiaryBenefitUseCase["execute"]>
  ): ReturnType<AddBeneficiaryBenefitUseCase["execute"]> {
    return this.AddBeneficiaryBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  replaceBeneficiary(
    ...args: Parameters<ReplaceBeneficiaryBenefitUseCase["execute"]>
  ): ReturnType<ReplaceBeneficiaryBenefitUseCase["execute"]> {
    return this.ReplaceBeneficiaryBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  balances(...args: Parameters<BalancesBenefitUseCase["execute"]>): ReturnType<BalancesBenefitUseCase["execute"]> {
    return this.BalancesBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  issueTicket(
    ...args: Parameters<IssueTicketBenefitUseCase["execute"]>
  ): ReturnType<IssueTicketBenefitUseCase["execute"]> {
    return this.IssueTicketBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  consume(...args: Parameters<ConsumeBenefitUseCase["execute"]>): ReturnType<ConsumeBenefitUseCase["execute"]> {
    return this.ConsumeBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  consumeTicket(
    ...args: Parameters<ConsumeTicketBenefitUseCase["execute"]>
  ): ReturnType<ConsumeTicketBenefitUseCase["execute"]> {
    return this.ConsumeTicketBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  reverse(...args: Parameters<ReverseBenefitUseCase["execute"]>): ReturnType<ReverseBenefitUseCase["execute"]> {
    return this.ReverseBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  history(...args: Parameters<HistoryBenefitUseCase["execute"]>): ReturnType<HistoryBenefitUseCase["execute"]> {
    return this.HistoryBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  clinicHistory(
    ...args: Parameters<ClinicHistoryBenefitUseCase["execute"]>
  ): ReturnType<ClinicHistoryBenefitUseCase["execute"]> {
    return this.ClinicHistoryBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: FamilyBenefitUseCase, useValue: { execute: value.family } },
      { provide: AddBeneficiaryBenefitUseCase, useValue: { execute: value.addBeneficiary } },
      { provide: ReplaceBeneficiaryBenefitUseCase, useValue: { execute: value.replaceBeneficiary } },
      { provide: BalancesBenefitUseCase, useValue: { execute: value.balances } },
      { provide: IssueTicketBenefitUseCase, useValue: { execute: value.issueTicket } },
      { provide: ConsumeBenefitUseCase, useValue: { execute: value.consume } },
      { provide: ConsumeTicketBenefitUseCase, useValue: { execute: value.consumeTicket } },
      { provide: ReverseBenefitUseCase, useValue: { execute: value.reverse } },
      { provide: HistoryBenefitUseCase, useValue: { execute: value.history } },
      { provide: ClinicHistoryBenefitUseCase, useValue: { execute: value.clinicHistory } }
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
      family: (...args: Parameters<FamilyBenefitUseCase["execute"]>) => app.get(FamilyBenefitUseCase).execute(...args),
      addBeneficiary: (...args: Parameters<AddBeneficiaryBenefitUseCase["execute"]>) =>
        app.get(AddBeneficiaryBenefitUseCase).execute(...args),
      replaceBeneficiary: (...args: Parameters<ReplaceBeneficiaryBenefitUseCase["execute"]>) =>
        app.get(ReplaceBeneficiaryBenefitUseCase).execute(...args),
      balances: (...args: Parameters<BalancesBenefitUseCase["execute"]>) =>
        app.get(BalancesBenefitUseCase).execute(...args),
      issueTicket: (...args: Parameters<IssueTicketBenefitUseCase["execute"]>) =>
        app.get(IssueTicketBenefitUseCase).execute(...args),
      consume: (...args: Parameters<ConsumeBenefitUseCase["execute"]>) =>
        app.get(ConsumeBenefitUseCase).execute(...args),
      consumeTicket: (...args: Parameters<ConsumeTicketBenefitUseCase["execute"]>) =>
        app.get(ConsumeTicketBenefitUseCase).execute(...args),
      reverse: (...args: Parameters<ReverseBenefitUseCase["execute"]>) =>
        app.get(ReverseBenefitUseCase).execute(...args),
      history: (...args: Parameters<HistoryBenefitUseCase["execute"]>) =>
        app.get(HistoryBenefitUseCase).execute(...args),
      clinicHistory: (...args: Parameters<ClinicHistoryBenefitUseCase["execute"]>) =>
        app.get(ClinicHistoryBenefitUseCase).execute(...args)
    };
  }
}
