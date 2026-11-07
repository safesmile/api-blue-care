import { ForbiddenException, MethodNotAllowedException } from "@nestjs/common";
import { AccessPolicy, type AccessActor } from "../../modules/authorization/domain/access-policy";
import type { Permission } from "../domain/permission";

export interface OperationPolicy {
  actorIndex: number;
  permissions: readonly Permission[];
  ownIndex?: number;
  ownPermission?: Permission;
  identity?: boolean;
  targetIndex?: number;
}

/** Centraliza las políticas declarativas sin mezclarlas con las reglas del negocio. */
export abstract class EntityUseCase<Args extends unknown[], Result> {
  protected policy?: OperationPolicy;
  protected readonly asynchronous: boolean = false;

  /**
   * Ejecuta una operación de negocio después de aplicar su política declarada.
   * @param args Entradas tipadas de la operación.
   * @returns Resultado de negocio.
   */
  execute(...args: Args): Result {
    if (this.asynchronous) {
      return Promise.resolve().then(() => {
        authorizeOperation(this.policy, args);
        return this.perform(...args);
      }) as Result;
    }
    authorizeOperation(this.policy, args);
    return this.perform(...args);
  }

  protected abstract perform(...args: Args): Result;
}

/**
 * Aplica permisos generales; el repositorio conserva propiedad, alcance y bloqueos.
 * @param policy Política declarada por la operación.
 * @param args Entradas de la operación.
 */
export function authorizeOperation(policy: OperationPolicy | undefined, args: readonly unknown[]) {
  if (!policy) return;
  const actor = args[policy.actorIndex] as AccessActor | undefined;
  const permissions = policy.ownPermission && args[policy.ownIndex!] ? [policy.ownPermission] : policy.permissions;
  const target = policy.targetIndex === undefined ? undefined : (args[policy.targetIndex] as string);
  if (
    !permissions.every(permission =>
      policy.identity ? AccessPolicy.identity(actor, permission, target) : AccessPolicy.allows(actor, permission)
    )
  )
    throw new ForbiddenException("No tiene permiso para realizar esta operación");
}

type Operation = (...args: any[]) => any;
type Action = "create" | "read" | "list" | "update" | "delete";
export type CrudOperations = Partial<Record<Action, Operation>>;
type Args<Operations, Key extends keyof Operations> = Operations[Key] extends Operation
  ? Parameters<Operations[Key]>
  : never;
type Result<Operations, Key extends keyof Operations> = Operations[Key] extends Operation
  ? ReturnType<Operations[Key]>
  : never;

/** Implementación común del CRUD; las entidades aportan solo persistencia y reglas específicas. */
export abstract class CrudEntityUseCase<Operations extends CrudOperations> {
  protected abstract readonly handlers: Operations;
  protected readonly policies: Partial<Record<Action, OperationPolicy>> = {};
  protected readonly asynchronousActions: readonly string[] = [];

  /**
   * Crea una entidad.
   * @param args Entradas de creación.
   * @returns Entidad creada.
   */
  create(...args: Args<Operations, "create">): Result<Operations, "create"> {
    return this.run("create", args);
  }
  /**
   * Lee una entidad.
   * @param args Identificador y alcance.
   * @returns Entidad encontrada.
   */
  read(...args: Args<Operations, "read">): Result<Operations, "read"> {
    return this.run("read", args);
  }
  /**
   * Lista entidades.
   * @param args Paginación y alcance.
   * @returns Página de entidades.
   */
  list(...args: Args<Operations, "list">): Result<Operations, "list"> {
    return this.run("list", args);
  }
  /**
   * Actualiza una entidad.
   * @param args Identificador, cambios y alcance.
   * @returns Entidad actualizada.
   */
  update(...args: Args<Operations, "update">): Result<Operations, "update"> {
    return this.run("update", args);
  }
  /**
   * Da de baja una entidad cuando el negocio lo permite.
   * @param args Identificador y alcance.
   * @returns Resultado de la baja.
   */
  delete(...args: Args<Operations, "delete">): Result<Operations, "delete"> {
    return this.run("delete", args);
  }

  /**
   * Aplica una política y delega a la implementación específica.
   * @param action Operación CRUD.
   * @param args Entradas de la operación.
   * @returns Resultado concreto.
   */
  private run<Key extends Action>(action: Key, args: unknown[]): Result<Operations, Key> {
    if (this.asynchronousActions.includes(action)) {
      return Promise.resolve().then(() => this.invoke(action, args)) as Result<Operations, Key>;
    }
    return this.invoke(action, args);
  }

  /**
   * Delega una operación autorizada a su implementación.
   * @param action Operación CRUD.
   * @param args Entradas tipadas.
   * @returns Resultado concreto.
   */
  private invoke<Key extends Action>(action: Key, args: unknown[]): Result<Operations, Key> {
    authorizeOperation(this.policies[action], args);
    const handler = this.handlers[action];
    if (!handler) throw new MethodNotAllowedException("Esta operación no está disponible para este recurso");
    return handler(...args);
  }
}
