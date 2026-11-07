import type { CrudOperations } from "../application/entity.usecase";
/** Comparte la delegación CRUD; cada controlador declara sus rutas, DTO y permisos explícitos. */
export abstract class CrudEntityController<Port extends CrudOperations> {
  /**
   * Recibe las dependencias de la operación.
   * @param resource Dependencia tipada de resource.
   */
  protected constructor(private readonly resource: Port) {}
  /**
   * Delega sin duplicar lógica de aplicación en los controladores.
   * @param action Operación disponible.
   * @param args Entradas concretas de la operación.
   * @returns Resultado concreto del caso de uso.
   */
  protected crud<Key extends keyof Port & keyof CrudOperations>(
    action: Key,
    ...args: Parameters<NonNullable<Port[Key]>>
  ): ReturnType<NonNullable<Port[Key]>> {
    return this.resource[action]!(...args);
  }
}
