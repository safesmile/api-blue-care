import { Injectable, ServiceUnavailableException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { FileStorage } from "./file-storage";
/**
 * Stores private objects and signs short-lived read links.
 */
@Injectable()
export class GcsFileStorage extends FileStorage {
  private readonly storage = new Storage();
  /**
   * Receives the dependencies required by this component.
   * @param config Validated application configuration.
   */
  constructor(private readonly config: ConfigService) {
    super();
  }
  /**
   * Resolves a validated private object key within the configured bucket.
   * @param key Private object storage key.
   * @returns Result of the completed operation.
   */
  private file(key: string) {
    if (!/^blue-dent\/[0-9a-f-]{36}$/.test(key)) throw new BadRequestException("Invalid object key");
    const bucket = this.config.get<string>("GCS_PRIVATE_BUCKET");
    if (!bucket) throw new ServiceUnavailableException("File storage is not configured");
    return this.storage.bucket(bucket).file(key);
  }
  /**
   * Uploads a supported private file and returns its object key.
   * @param data File content to store.
   * @param contentType Declared MIME type of the file.
   * @returns Result of the completed operation.
   */
  async upload(data: Buffer, contentType: string) {
    if (!["image/jpeg", "image/png", "application/pdf"].includes(contentType) || data.length > 10 * 1024 * 1024)
      throw new BadRequestException("Unsupported file or size exceeds 10 MB");
    const key = "blue-dent/" + randomUUID();
    await this.file(key).save(data, {
      resumable: false,
      metadata: { contentType },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
    return key;
  }
  /**
   * Creates a temporary signed URL for a private object.
   * @param key Private object storage key.
   * @returns Result of the completed operation.
   */
  async signedReadUrl(key: string) {
    const [url] = await this.file(key).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 5 * 60 * 1000
    });
    return url;
  }
  /**
   * Deletes the resource identified by its ID.
   * @param key Private object storage key.
   */
  async delete(key: string) {
    await this.file(key).delete({ ignoreNotFound: true });
  }
}
