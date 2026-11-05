import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/presentation/auth.decorators";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
import { PreventionUseCase } from "../application/prevention.usecase";
/** OIDC protected durable sweep, independent of user permissions. */
@Controller("internal/jobs/prevention")
@Public()
@UseGuards(GoogleJobGuard)
@SkipThrottle()
export class PreventionJobsController {
  /**
   * Receives the explicit persistence and transport dependencies.
   * @param prevention Explicit prevention value for this operation.
   */
  constructor(private readonly prevention: PreventionUseCase) {}
  /**
   * Runs the authorized internal recovery sweep.
   * @returns The authorized result or completion of the operation.
   */
  @Post("dispatch") @HttpCode(200) dispatch() {
    return this.prevention.drain();
  }
}
