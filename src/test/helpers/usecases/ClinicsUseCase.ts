import { ClinicRepository } from "../../../modules/clinics/domain/clinic.repository";
import { AvailableClinicUseCase } from "../../../modules/clinics/application/availableClinic.usecase";
import { CrudClinicsUseCase } from "../../../modules/clinics/application/crudClinics.usecase";
import { StaffClinicUseCase } from "../../../modules/clinics/application/staffClinic.usecase";
import { AssignClinicUseCase } from "../../../modules/clinics/application/assignClinic.usecase";
import { UnassignClinicUseCase } from "../../../modules/clinics/application/unassignClinic.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class ClinicsUseCase {
  private readonly AvailableClinicUseCase: AvailableClinicUseCase;
  private readonly CrudClinicsUseCase: CrudClinicsUseCase;
  private readonly StaffClinicUseCase: StaffClinicUseCase;
  private readonly AssignClinicUseCase: AssignClinicUseCase;
  private readonly UnassignClinicUseCase: UnassignClinicUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param clinics Dependencia tipada de clinics.
   */
  constructor(clinics: ClinicRepository) {
    this.AvailableClinicUseCase = new AvailableClinicUseCase(clinics);
    this.CrudClinicsUseCase = new CrudClinicsUseCase(clinics);
    this.StaffClinicUseCase = new StaffClinicUseCase(clinics);
    this.AssignClinicUseCase = new AssignClinicUseCase(clinics);
    this.UnassignClinicUseCase = new UnassignClinicUseCase(clinics);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  available(...args: Parameters<AvailableClinicUseCase["execute"]>): ReturnType<AvailableClinicUseCase["execute"]> {
    return this.AvailableClinicUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudClinicsUseCase["create"]>): ReturnType<CrudClinicsUseCase["create"]> {
    return this.CrudClinicsUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudClinicsUseCase["read"]>): ReturnType<CrudClinicsUseCase["read"]> {
    return this.CrudClinicsUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudClinicsUseCase["list"]>): ReturnType<CrudClinicsUseCase["list"]> {
    return this.CrudClinicsUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  update(...args: Parameters<CrudClinicsUseCase["update"]>): ReturnType<CrudClinicsUseCase["update"]> {
    return this.CrudClinicsUseCase.update(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  staff(...args: Parameters<StaffClinicUseCase["execute"]>): ReturnType<StaffClinicUseCase["execute"]> {
    return this.StaffClinicUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  assign(...args: Parameters<AssignClinicUseCase["execute"]>): ReturnType<AssignClinicUseCase["execute"]> {
    return this.AssignClinicUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  unassign(...args: Parameters<UnassignClinicUseCase["execute"]>): ReturnType<UnassignClinicUseCase["execute"]> {
    return this.UnassignClinicUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: AvailableClinicUseCase, useValue: { execute: value.available } },
      { provide: CrudClinicsUseCase, useValue: value },
      { provide: StaffClinicUseCase, useValue: { execute: value.staff } },
      { provide: AssignClinicUseCase, useValue: { execute: value.assign } },
      { provide: UnassignClinicUseCase, useValue: { execute: value.unassign } }
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
      available: (...args: Parameters<AvailableClinicUseCase["execute"]>) =>
        app.get(AvailableClinicUseCase).execute(...args),
      create: (...args: Parameters<CrudClinicsUseCase["create"]>) => app.get(CrudClinicsUseCase).create(...args),
      read: (...args: Parameters<CrudClinicsUseCase["read"]>) => app.get(CrudClinicsUseCase).read(...args),
      list: (...args: Parameters<CrudClinicsUseCase["list"]>) => app.get(CrudClinicsUseCase).list(...args),
      update: (...args: Parameters<CrudClinicsUseCase["update"]>) => app.get(CrudClinicsUseCase).update(...args),
      staff: (...args: Parameters<StaffClinicUseCase["execute"]>) => app.get(StaffClinicUseCase).execute(...args),
      assign: (...args: Parameters<AssignClinicUseCase["execute"]>) => app.get(AssignClinicUseCase).execute(...args),
      unassign: (...args: Parameters<UnassignClinicUseCase["execute"]>) =>
        app.get(UnassignClinicUseCase).execute(...args)
    };
  }
}
