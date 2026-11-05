import type { Page, Pagination } from "../domain/crud.repository";
// No route decorators: endpoints and permissions belong to concrete controllers.
/**
 * Declares explicit CRUD operations for concrete implementations.
 */
export abstract class CrudController<View, Create, Update, Context = unknown> {
  /**
   * Creates the resource using the supplied input.
   * @param input Validated input for this operation.
   */
  abstract create(input: Create, context: Context): Promise<View>;
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract read(id: string, context: Context): Promise<View>;
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   */
  abstract list(page: Pagination, context: Context): Promise<Page<View>>;
  /**
   * Updates the permitted resource properties.
   * @param id Resource identifier.
   * @param input Validated input for this operation.
   */
  abstract update(id: string, input: Update, context: Context): Promise<View>;
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract delete(id: string, context: Context): Promise<void>;
}
