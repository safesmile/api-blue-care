import { Controller, HttpCode, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../auth/presentation/auth.decorators";
import { MembershipsUseCase } from "../application/memberships.usecase";
/** Signature verification uses original bytes before any resource or amount is trusted. */
@Controller("webhooks/recurrente")
export class RecurrenteWebhookController {
  /**
   * Receives the persistence and policy boundaries.
   * @param memberships Patient-global membership repository port.
   */
  constructor(private readonly memberships: MembershipsUseCase) {}
  /**
   * Persists a verified minimal provider envelope before acknowledgement.
   * @param request Request containing the authenticated identity or original webhook bytes.
   * @returns The persisted result or completion of the authorized operation.
   */
  @Post() @Public() @SkipThrottle() @HttpCode(204) receive(@Req() request: RawBodyRequest<Request>) {
    return this.memberships.receive(request.rawBody!, request.headers);
  }
}
