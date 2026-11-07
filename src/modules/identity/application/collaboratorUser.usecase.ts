import type { CollaboratorView } from "../domain/user";
import { PermissionCode } from "../../../shared/domain/permission-code";
import { type AccessActor } from "../../authorization/domain/access-policy";
import { Injectable, NotFoundException } from "@nestjs/common";
import { IdentityRepository } from "../domain/identity.repository";
import { EntityUseCase, type OperationPolicy } from "../../../shared/application/entity.usecase";

/** Caso de uso específico de User. */
@Injectable()
export class CollaboratorUserUseCase extends EntityUseCase<
  [id: string, actor: AccessActor],
  Promise<CollaboratorView>
> {
  protected readonly policy: OperationPolicy = { actorIndex: 1, permissions: [PermissionCode.ClinicsStaffList] };

  protected readonly asynchronous = true;

  /**
   * Recibe las dependencias de la operación.
   * @param users Dependencia tipada de users.
   */
  constructor(private readonly users: IdentityRepository) {
    super();
  }
  /**
   *
   * @param id Entrada de la operación.
   * @param actor Entrada de la operación.
   * @returns Resultado de la operación.
   */
  protected async perform(id: string, actor: AccessActor) {
    const result = await this.users.collaborators({ limit: 1, offset: 0 }, actor, id);
    if (!result.items.length) throw new NotFoundException("No se encontró el colaborador");
    return result.items[0];
  }
}
