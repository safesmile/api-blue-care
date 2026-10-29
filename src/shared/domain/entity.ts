import { randomUUID } from "node:crypto";
/**
 * Defines the resource contract.
 */
export abstract class Entity<P> {
  /**
   * Receives the dependencies required by this component.
   * @param props Value required by this operation.
   * @param id Resource identifier.
   */
  constructor(
    public readonly props: P,
    public readonly id: string = randomUUID()
  ) {}
}
