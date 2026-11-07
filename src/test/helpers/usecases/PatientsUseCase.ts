import { PatientsRules } from "../../../modules/patients/application/patientsRules.service";
import { PatientRepository } from "../../../modules/patients/domain/patient.repository";
import { CrudPatientsUseCase } from "../../../modules/patients/application/crudPatients.usecase";
import { OwnPatientUseCase } from "../../../modules/patients/application/ownPatient.usecase";
import { UpdateOwnPatientUseCase } from "../../../modules/patients/application/updateOwnPatient.usecase";
import { LinkPatientUseCase } from "../../../modules/patients/application/linkPatient.usecase";
import { AssociatePatientUseCase } from "../../../modules/patients/application/associatePatient.usecase";
import { ClinicsPatientUseCase } from "../../../modules/patients/application/clinicsPatient.usecase";
import { DissociatePatientUseCase } from "../../../modules/patients/application/dissociatePatient.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class PatientsUseCase {
  private readonly CrudPatientsUseCase: CrudPatientsUseCase;
  private readonly OwnPatientUseCase: OwnPatientUseCase;
  private readonly UpdateOwnPatientUseCase: UpdateOwnPatientUseCase;
  private readonly LinkPatientUseCase: LinkPatientUseCase;
  private readonly AssociatePatientUseCase: AssociatePatientUseCase;
  private readonly ClinicsPatientUseCase: ClinicsPatientUseCase;
  private readonly DissociatePatientUseCase: DissociatePatientUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param patients Dependencia tipada de patients.
   */
  constructor(patients: PatientRepository) {
    this.CrudPatientsUseCase = new CrudPatientsUseCase(patients, new PatientsRules());
    this.OwnPatientUseCase = new OwnPatientUseCase(patients);
    this.UpdateOwnPatientUseCase = new UpdateOwnPatientUseCase(
      patients,
      new OwnPatientUseCase(patients),
      new PatientsRules()
    );
    this.LinkPatientUseCase = new LinkPatientUseCase(patients);
    this.AssociatePatientUseCase = new AssociatePatientUseCase(patients);
    this.ClinicsPatientUseCase = new ClinicsPatientUseCase(patients);
    this.DissociatePatientUseCase = new DissociatePatientUseCase(patients);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudPatientsUseCase["create"]>): ReturnType<CrudPatientsUseCase["create"]> {
    return this.CrudPatientsUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudPatientsUseCase["read"]>): ReturnType<CrudPatientsUseCase["read"]> {
    return this.CrudPatientsUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudPatientsUseCase["list"]>): ReturnType<CrudPatientsUseCase["list"]> {
    return this.CrudPatientsUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  update(...args: Parameters<CrudPatientsUseCase["update"]>): ReturnType<CrudPatientsUseCase["update"]> {
    return this.CrudPatientsUseCase.update(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  own(...args: Parameters<OwnPatientUseCase["execute"]>): ReturnType<OwnPatientUseCase["execute"]> {
    return this.OwnPatientUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  updateOwn(...args: Parameters<UpdateOwnPatientUseCase["execute"]>): ReturnType<UpdateOwnPatientUseCase["execute"]> {
    return this.UpdateOwnPatientUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  link(...args: Parameters<LinkPatientUseCase["execute"]>): ReturnType<LinkPatientUseCase["execute"]> {
    return this.LinkPatientUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  associate(...args: Parameters<AssociatePatientUseCase["execute"]>): ReturnType<AssociatePatientUseCase["execute"]> {
    return this.AssociatePatientUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  clinics(...args: Parameters<ClinicsPatientUseCase["execute"]>): ReturnType<ClinicsPatientUseCase["execute"]> {
    return this.ClinicsPatientUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  dissociate(
    ...args: Parameters<DissociatePatientUseCase["execute"]>
  ): ReturnType<DissociatePatientUseCase["execute"]> {
    return this.DissociatePatientUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: CrudPatientsUseCase, useValue: value },
      { provide: OwnPatientUseCase, useValue: { execute: value.own } },
      { provide: UpdateOwnPatientUseCase, useValue: { execute: value.updateOwn } },
      { provide: LinkPatientUseCase, useValue: { execute: value.link } },
      { provide: AssociatePatientUseCase, useValue: { execute: value.associate } },
      { provide: ClinicsPatientUseCase, useValue: { execute: value.clinics } },
      { provide: DissociatePatientUseCase, useValue: { execute: value.dissociate } }
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
      create: (...args: Parameters<CrudPatientsUseCase["create"]>) => app.get(CrudPatientsUseCase).create(...args),
      read: (...args: Parameters<CrudPatientsUseCase["read"]>) => app.get(CrudPatientsUseCase).read(...args),
      list: (...args: Parameters<CrudPatientsUseCase["list"]>) => app.get(CrudPatientsUseCase).list(...args),
      update: (...args: Parameters<CrudPatientsUseCase["update"]>) => app.get(CrudPatientsUseCase).update(...args),
      own: (...args: Parameters<OwnPatientUseCase["execute"]>) => app.get(OwnPatientUseCase).execute(...args),
      updateOwn: (...args: Parameters<UpdateOwnPatientUseCase["execute"]>) =>
        app.get(UpdateOwnPatientUseCase).execute(...args),
      link: (...args: Parameters<LinkPatientUseCase["execute"]>) => app.get(LinkPatientUseCase).execute(...args),
      associate: (...args: Parameters<AssociatePatientUseCase["execute"]>) =>
        app.get(AssociatePatientUseCase).execute(...args),
      clinics: (...args: Parameters<ClinicsPatientUseCase["execute"]>) =>
        app.get(ClinicsPatientUseCase).execute(...args),
      dissociate: (...args: Parameters<DissociatePatientUseCase["execute"]>) =>
        app.get(DissociatePatientUseCase).execute(...args)
    };
  }
}
