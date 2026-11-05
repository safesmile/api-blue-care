import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/presentation/auth.decorators";
import { GoogleJobGuard } from "../../../infrastructure/jobs/google-job.guard";
import { MembershipsUseCase } from "../application/memberships.usecase";
/** Internal durable sweep is protected with Google OIDC, independently of ordinary user JWTs. */
@Controller("internal/jobs/memberships")
@Public()
@UseGuards(GoogleJobGuard)
@SkipThrottle()
export class MembershipJobsController {
  /**
   * Receives the persistence and policy boundaries.
   * @param memberships Patient-global membership repository port.
   */
  constructor(private readonly memberships: MembershipsUseCase) {}
  /**
   * Runs the durable sweep after internal OIDC authorization.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post("dispatch") @HttpCode(200) dispatch() {
    return this.memberships.drain();
  }
}
