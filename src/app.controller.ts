import { Controller, Get } from "@nestjs/common";
import { Public } from "./modules/auth/presentation/auth.decorators";
/**
 * Exposes application liveness.
 */
@Controller("health")
export class AppController {
  /**
   * Returns the application liveness response.
   * @returns Result of the completed operation.
   */
  @Public() @Get() health() {
    return { status: "ok", service: "blue-dent" };
  }
}
