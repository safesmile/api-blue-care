export interface Page<T> {
  items: T[];
  total: number;
}
export interface Pagination {
  limit: number;
  offset: number;
}
/**
 * Defines the persistence operations required by the domain.
 */
export abstract class CrudRepository<T> {
  /**
   * Creates the resource using the supplied input.
   * @param entity Value required by this operation.
   */
  abstract create(entity: T): Promise<T>;
  /**
   * Returns the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract read(id: string): Promise<T | null>;
  /**
   * Returns a bounded page of resources and its total count.
   * @param page Bounded pagination values.
   */
  abstract list(page: Pagination): Promise<Page<T>>;
  /**
   * Updates the permitted resource properties.
   * @param entity Value required by this operation.
   */
  abstract update(entity: T): Promise<T>;
  /**
   * Deletes the resource identified by its ID.
   * @param id Resource identifier.
   */
  abstract delete(id: string): Promise<void>;
}
