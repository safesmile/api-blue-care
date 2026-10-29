import type { Page, Pagination } from "../domain/crud.repository";
// Contract only: each entity implements its own business rules explicitly.
/**
 * Declares explicit CRUD operations for concrete implementations.
 */
export abstract class CrudUseCase<T, Create, Update> {
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   */
  abstract create(input: Create): Promise<T>;
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract read(id: string): Promise<T>;
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   */
  abstract list(page: Pagination): Promise<Page<T>>;
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   */
  abstract update(id: string, input: Update): Promise<T>;
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract delete(id: string): Promise<void>;
}
