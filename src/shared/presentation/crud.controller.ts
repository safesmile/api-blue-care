import type { Page, Pagination } from "../domain/crud.repository";
// No route decorators: endpoints and permissions belong to concrete controllers.
/**
 * Declares explicit CRUD operations for concrete implementations.
 */
export abstract class CrudController<View, Create, Update> {
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   */
  abstract create(input: Create): Promise<View>;
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract read(id: string): Promise<View>;
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   */
  abstract list(page: Pagination): Promise<Page<View>>;
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   */
  abstract update(id: string, input: Update): Promise<View>;
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract delete(id: string): Promise<void>;
}
