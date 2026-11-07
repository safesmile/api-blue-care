import { AuditRepository } from "../../../modules/audit/domain/audit.repository";
import { CrudAuditUseCase } from "../../../modules/audit/application/crudAudit.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class AuditUseCase {
  private readonly CrudAuditUseCase: CrudAuditUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param records Dependencia tipada de records.
   */
  constructor(records: AuditRepository) {
    this.CrudAuditUseCase = new CrudAuditUseCase(records);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudAuditUseCase["list"]>): ReturnType<CrudAuditUseCase["list"]> {
    return this.CrudAuditUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudAuditUseCase["read"]>): ReturnType<CrudAuditUseCase["read"]> {
    return this.CrudAuditUseCase.read(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [{ provide: CrudAuditUseCase, useValue: value }];
  }
  /**
   *
   * @param app Entrada de la operación.
   * @param app.get Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static resolve(app: { get(token: any): any }) {
    return {
      list: (...args: Parameters<CrudAuditUseCase["list"]>) => app.get(CrudAuditUseCase).list(...args),
      read: (...args: Parameters<CrudAuditUseCase["read"]>) => app.get(CrudAuditUseCase).read(...args)
    };
  }
}
