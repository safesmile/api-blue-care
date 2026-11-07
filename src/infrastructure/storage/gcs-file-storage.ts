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
   * Recibe las dependencias de la operación.
   * @param config Dependencia tipada de config.
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
    if (!/^blue-dent\/[0-9a-f-]{36}$/.test(key)) throw new BadRequestException("La clave del archivo no es válida");
    const bucket = this.config.get<string>("GCS_PRIVATE_BUCKET");
    if (!bucket) throw new ServiceUnavailableException("El almacenamiento de archivos no está configurado");
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
      throw new BadRequestException("El archivo no está permitido o supera el límite de 10 MB");
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
