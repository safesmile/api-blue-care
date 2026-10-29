import { Module } from "@nestjs/common";
import { FileStorage } from "./file-storage";
import { GcsFileStorage } from "./gcs-file-storage";
/**
 * Wires the providers and controllers for this module.
 */
@Module({
  providers: [{ provide: FileStorage, useClass: GcsFileStorage }],
  exports: [FileStorage]
})
export class StorageModule {}
