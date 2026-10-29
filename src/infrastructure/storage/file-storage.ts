/**
 * Defines the resource contract.
 */
export abstract class FileStorage {
  /**
   * Uploads a supported private file and returns its object key.
   * @param data File content to store.
   * @param contentType Declared MIME type of the file.
   */
  abstract upload(data: Buffer, contentType: string): Promise<string>;
  /**
   * Creates a temporary signed URL for a private object.
   * @param key Private object storage key.
   */
  abstract signedReadUrl(key: string): Promise<string>;
  /**
   * Deletes the resource identified by its ID.
   * @param key Private object storage key.
   */
  abstract delete(key: string): Promise<void>;
}
