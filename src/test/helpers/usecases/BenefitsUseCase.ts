import { BenefitRepository } from "../../../modules/benefits/domain/benefit.repository";
import { CrudBenefitsUseCase } from "../../../modules/benefits/application/crudBenefits.usecase";
import { VersionBenefitUseCase } from "../../../modules/benefits/application/versionBenefit.usecase";
import { VersionsBenefitUseCase } from "../../../modules/benefits/application/versionsBenefit.usecase";
import { PublishBenefitUseCase } from "../../../modules/benefits/application/publishBenefit.usecase";
import { FamilySettingsBenefitUseCase } from "../../../modules/benefits/application/familySettingsBenefit.usecase";
import { UpdateFamilySettingsBenefitUseCase } from "../../../modules/benefits/application/updateFamilySettingsBenefit.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class BenefitsUseCase {
  private readonly CrudBenefitsUseCase: CrudBenefitsUseCase;
  private readonly VersionBenefitUseCase: VersionBenefitUseCase;
  private readonly VersionsBenefitUseCase: VersionsBenefitUseCase;
  private readonly PublishBenefitUseCase: PublishBenefitUseCase;
  private readonly FamilySettingsBenefitUseCase: FamilySettingsBenefitUseCase;
  private readonly UpdateFamilySettingsBenefitUseCase: UpdateFamilySettingsBenefitUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param benefits Dependencia tipada de benefits.
   */
  constructor(benefits: BenefitRepository) {
    this.CrudBenefitsUseCase = new CrudBenefitsUseCase(benefits);
    this.VersionBenefitUseCase = new VersionBenefitUseCase(benefits);
    this.VersionsBenefitUseCase = new VersionsBenefitUseCase(benefits);
    this.PublishBenefitUseCase = new PublishBenefitUseCase(benefits);
    this.FamilySettingsBenefitUseCase = new FamilySettingsBenefitUseCase(benefits);
    this.UpdateFamilySettingsBenefitUseCase = new UpdateFamilySettingsBenefitUseCase(benefits);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudBenefitsUseCase["create"]>): ReturnType<CrudBenefitsUseCase["create"]> {
    return this.CrudBenefitsUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudBenefitsUseCase["read"]>): ReturnType<CrudBenefitsUseCase["read"]> {
    return this.CrudBenefitsUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudBenefitsUseCase["list"]>): ReturnType<CrudBenefitsUseCase["list"]> {
    return this.CrudBenefitsUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  version(...args: Parameters<VersionBenefitUseCase["execute"]>): ReturnType<VersionBenefitUseCase["execute"]> {
    return this.VersionBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  versions(...args: Parameters<VersionsBenefitUseCase["execute"]>): ReturnType<VersionsBenefitUseCase["execute"]> {
    return this.VersionsBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  publish(...args: Parameters<PublishBenefitUseCase["execute"]>): ReturnType<PublishBenefitUseCase["execute"]> {
    return this.PublishBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  familySettings(
    ...args: Parameters<FamilySettingsBenefitUseCase["execute"]>
  ): ReturnType<FamilySettingsBenefitUseCase["execute"]> {
    return this.FamilySettingsBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  updateFamilySettings(
    ...args: Parameters<UpdateFamilySettingsBenefitUseCase["execute"]>
  ): ReturnType<UpdateFamilySettingsBenefitUseCase["execute"]> {
    return this.UpdateFamilySettingsBenefitUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: CrudBenefitsUseCase, useValue: value },
      { provide: VersionBenefitUseCase, useValue: { execute: value.version } },
      { provide: VersionsBenefitUseCase, useValue: { execute: value.versions } },
      { provide: PublishBenefitUseCase, useValue: { execute: value.publish } },
      { provide: FamilySettingsBenefitUseCase, useValue: { execute: value.familySettings } },
      { provide: UpdateFamilySettingsBenefitUseCase, useValue: { execute: value.updateFamilySettings } }
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
      create: (...args: Parameters<CrudBenefitsUseCase["create"]>) => app.get(CrudBenefitsUseCase).create(...args),
      read: (...args: Parameters<CrudBenefitsUseCase["read"]>) => app.get(CrudBenefitsUseCase).read(...args),
      list: (...args: Parameters<CrudBenefitsUseCase["list"]>) => app.get(CrudBenefitsUseCase).list(...args),
      version: (...args: Parameters<VersionBenefitUseCase["execute"]>) =>
        app.get(VersionBenefitUseCase).execute(...args),
      versions: (...args: Parameters<VersionsBenefitUseCase["execute"]>) =>
        app.get(VersionsBenefitUseCase).execute(...args),
      publish: (...args: Parameters<PublishBenefitUseCase["execute"]>) =>
        app.get(PublishBenefitUseCase).execute(...args),
      familySettings: (...args: Parameters<FamilySettingsBenefitUseCase["execute"]>) =>
        app.get(FamilySettingsBenefitUseCase).execute(...args),
      updateFamilySettings: (...args: Parameters<UpdateFamilySettingsBenefitUseCase["execute"]>) =>
        app.get(UpdateFamilySettingsBenefitUseCase).execute(...args)
    };
  }
}
