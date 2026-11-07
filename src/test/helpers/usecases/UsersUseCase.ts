import { UsersRules } from "../../../modules/identity/application/usersRules.service";
import { RolesRepository } from "../../../modules/authorization/domain/roles.repository";
import { IdentityRepository } from "../../../modules/identity/domain/identity.repository";
import { PasswordHasher } from "../../../modules/identity/domain/password-hasher";
import { CollaboratorsUserUseCase } from "../../../modules/identity/application/collaboratorsUser.usecase";
import { CollaboratorUserUseCase } from "../../../modules/identity/application/collaboratorUser.usecase";
import { CrudUsersUseCase } from "../../../modules/identity/application/crudUsers.usecase";
/** Adaptador de pruebas de regresión; no se registra en la aplicación. */
export class UsersUseCase {
  private readonly CollaboratorsUserUseCase: CollaboratorsUserUseCase;
  private readonly CollaboratorUserUseCase: CollaboratorUserUseCase;
  private readonly CrudUsersUseCase: CrudUsersUseCase;
  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   * @param passwords Dependencia tipada de passwords.
   * @param roles Dependencia tipada de roles.
   */
  constructor(users: IdentityRepository, passwords: PasswordHasher, roles: RolesRepository) {
    this.CollaboratorsUserUseCase = new CollaboratorsUserUseCase(users);
    this.CollaboratorUserUseCase = new CollaboratorUserUseCase(users);
    this.CrudUsersUseCase = new CrudUsersUseCase(users, passwords, roles, new UsersRules(users));
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  collaborators(
    ...args: Parameters<CollaboratorsUserUseCase["execute"]>
  ): ReturnType<CollaboratorsUserUseCase["execute"]> {
    return this.CollaboratorsUserUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  collaborator(
    ...args: Parameters<CollaboratorUserUseCase["execute"]>
  ): ReturnType<CollaboratorUserUseCase["execute"]> {
    return this.CollaboratorUserUseCase.execute(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  create(...args: Parameters<CrudUsersUseCase["create"]>): ReturnType<CrudUsersUseCase["create"]> {
    return this.CrudUsersUseCase.create(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  read(...args: Parameters<CrudUsersUseCase["read"]>): ReturnType<CrudUsersUseCase["read"]> {
    return this.CrudUsersUseCase.read(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  list(...args: Parameters<CrudUsersUseCase["list"]>): ReturnType<CrudUsersUseCase["list"]> {
    return this.CrudUsersUseCase.list(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  update(...args: Parameters<CrudUsersUseCase["update"]>): ReturnType<CrudUsersUseCase["update"]> {
    return this.CrudUsersUseCase.update(...args);
  }
  /**
   *
   * @param args Entrada de la operación.
   * @returns Resultado de la operación.
   */
  delete(...args: Parameters<CrudUsersUseCase["delete"]>): ReturnType<CrudUsersUseCase["delete"]> {
    return this.CrudUsersUseCase.delete(...args);
  }
  /**
   *
   * @param value Entrada de la operación.
   * @returns Resultado de la operación.
   */
  static providers(value: any) {
    return [
      { provide: CollaboratorsUserUseCase, useValue: { execute: value.collaborators } },
      { provide: CollaboratorUserUseCase, useValue: { execute: value.collaborator } },
      { provide: CrudUsersUseCase, useValue: value }
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
      collaborators: (...args: Parameters<CollaboratorsUserUseCase["execute"]>) =>
        app.get(CollaboratorsUserUseCase).execute(...args),
      collaborator: (...args: Parameters<CollaboratorUserUseCase["execute"]>) =>
        app.get(CollaboratorUserUseCase).execute(...args),
      create: (...args: Parameters<CrudUsersUseCase["create"]>) => app.get(CrudUsersUseCase).create(...args),
      read: (...args: Parameters<CrudUsersUseCase["read"]>) => app.get(CrudUsersUseCase).read(...args),
      list: (...args: Parameters<CrudUsersUseCase["list"]>) => app.get(CrudUsersUseCase).list(...args),
      update: (...args: Parameters<CrudUsersUseCase["update"]>) => app.get(CrudUsersUseCase).update(...args),
      delete: (...args: Parameters<CrudUsersUseCase["delete"]>) => app.get(CrudUsersUseCase).delete(...args)
    };
  }
}
