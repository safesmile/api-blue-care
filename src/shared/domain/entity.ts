import { randomUUID } from "node:crypto";
/**
 * Defines the resource contract.
 */
export abstract class Entity<P> {
  /**
   * Recibe las dependencias de la operación.
   * @param props Dependencia tipada de props.
   * @param id Dependencia tipada de id.
   */
  constructor(
    public readonly props: P,
    public readonly id: string = randomUUID()
  ) {}
}
