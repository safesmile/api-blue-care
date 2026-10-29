import { Injectable } from "@nestjs/common";

/**
 * Provides the initial application greeting.
 */
@Injectable()
export class AppService {
  /**
   * Returns the initial application greeting.
   * @returns Result of the completed operation.
   */
  getHello(): string {
    return "Hello World!";
  }
}
