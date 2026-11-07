import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/presentation/auth.decorators";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
import { DrainPreventionEventUseCase } from "../application/drainPreventionEvent.usecase";
/** OIDC protected durable sweep, independent of user permissions. */
@Controller("internal/jobs/prevention")
@Public()
@UseGuards(GoogleJobGuard)
@SkipThrottle()
export class PreventionJobsController {
  /**
   * Recibe las dependencias de la operación.
   * @param drainPreventionEvent Dependencia tipada de drainPreventionEvent.
   */
  constructor(private readonly drainPreventionEvent: DrainPreventionEventUseCase) {}
  /**
   * Runs the authorized internal recovery sweep.
   * @returns The authorized result or completion of the operation.
   */
  @Post("dispatch") @HttpCode(200) dispatch() {
    return this.drainPreventionEvent.execute();
  }
}
