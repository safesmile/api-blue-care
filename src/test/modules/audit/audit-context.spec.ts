import { Observable, firstValueFrom } from "rxjs";
import type { ExecutionContext } from "@nestjs/common";
import { AuditInterceptor } from "../../../modules/audit/infrastructure/audit.interceptor";
import { auditContext } from "../../../modules/audit/infrastructure/audit-context";
describe("Request audit context", () => {
  it("isolates concurrent actors and reasons without copying tokens, query strings or caller identity headers", async () => {
    const interceptor = new AuditInterceptor();
    const execute = (id: string, reason: unknown, delay: number) => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id },
            headers: { "x-actor-id": "spoofed" },
            body: { reason, password: "secret", token: "secret" },
            query: { token: "secret" }
          }),
          getResponse: () => ({ setHeader: jest.fn() })
        })
      } as unknown as ExecutionContext;
      return firstValueFrom(
        interceptor.intercept(context, {
          handle: () =>
            new Observable(subscriber => {
              setTimeout(() => {
                subscriber.next(auditContext.getStore());
                subscriber.complete();
              }, delay);
            })
        })
      );
    };
    const [a, b] = (await Promise.all([execute("a", " Reason A ", 10), execute("b", 123, 0)])) as {
      actorId: string;
      reason?: string;
      requestId: string;
    }[];
    expect(a.actorId).toBe("a");
    expect(a.reason).toBe("Reason A");
    expect(b.actorId).toBe("b");
    expect(b.reason).toBeUndefined();
    expect(a.requestId).not.toBe(b.requestId);
    expect(JSON.stringify([a, b])).not.toContain("secret");
    expect(auditContext.getStore()).toBeUndefined();
  });
});
