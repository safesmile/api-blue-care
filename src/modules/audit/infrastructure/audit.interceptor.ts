import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { randomUUID } from "node:crypto";
import type { AuthRequest } from "../../auth/presentation/auth.guard";
import { auditContext } from "./audit-context";
/** Carries server-selected actor/correlation metadata into transactional adapters. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  /**
   *
   * @param context Current HTTP execution context.
   * @param next Next request handler.
   * @returns Result of the completed operation.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const requestId = randomUUID();
    context.switchToHttp().getResponse().setHeader("X-Request-ID", requestId);
    const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : undefined;
    return new Observable(subscriber =>
      auditContext.run({ requestId, actorId: request.user?.id, reason }, () => {
        const subscription = next.handle().subscribe(subscriber);
        return () => subscription.unsubscribe();
      })
    );
  }
}
