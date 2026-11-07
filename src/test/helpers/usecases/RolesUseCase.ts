import { RolesRepository } from "../../../modules/authorization/domain/roles.repository";
import { CrudRolesUseCase } from "../../../modules/authorization/application/crudRoles.usecase";
import { CatalogRoleUseCase } from "../../../modules/authorization/application/catalogRole.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class RolesUseCase {
  private readonly CrudRolesUseCase: CrudRolesUseCase;
  private readonly CatalogRoleUseCase: CatalogRoleUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param roles Dependencia tipada de roles.
   */
  constructor(roles: RolesRepository) {
    this.CrudRolesUseCase = new CrudRolesUseCase(roles);
    this.CatalogRoleUseCase = new CatalogRoleUseCase(roles);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudRolesUseCase["list"]>): ReturnType<CrudRolesUseCase["list"]> {
    return this.CrudRolesUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudRolesUseCase["read"]>): ReturnType<CrudRolesUseCase["read"]> {
    return this.CrudRolesUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudRolesUseCase["create"]>): ReturnType<CrudRolesUseCase["create"]> {
    return this.CrudRolesUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  update(...args: Parameters<CrudRolesUseCase["update"]>): ReturnType<CrudRolesUseCase["update"]> {
    return this.CrudRolesUseCase.update(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  delete(...args: Parameters<CrudRolesUseCase["delete"]>): ReturnType<CrudRolesUseCase["delete"]> {
    return this.CrudRolesUseCase.delete(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  catalog(...args: Parameters<CatalogRoleUseCase["execute"]>): ReturnType<CatalogRoleUseCase["execute"]> {
    return this.CatalogRoleUseCase.execute(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: CrudRolesUseCase, useValue: value },
      { provide: CatalogRoleUseCase, useValue: { execute: value.catalog } }
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
      list: (...args: Parameters<CrudRolesUseCase["list"]>) => app.get(CrudRolesUseCase).list(...args),
      read: (...args: Parameters<CrudRolesUseCase["read"]>) => app.get(CrudRolesUseCase).read(...args),
      create: (...args: Parameters<CrudRolesUseCase["create"]>) => app.get(CrudRolesUseCase).create(...args),
      update: (...args: Parameters<CrudRolesUseCase["update"]>) => app.get(CrudRolesUseCase).update(...args),
      delete: (...args: Parameters<CrudRolesUseCase["delete"]>) => app.get(CrudRolesUseCase).delete(...args),
      catalog: (...args: Parameters<CatalogRoleUseCase["execute"]>) => app.get(CatalogRoleUseCase).execute(...args)
    };
  }
}
